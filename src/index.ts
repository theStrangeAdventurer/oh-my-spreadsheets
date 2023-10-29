import { google } from 'googleapis';

import type {
  ColumnIndexes,
  Columns,
  Field,
  Keys,
  MapperValues,
  RowValues,
  UpdatableData,
  Values,
} from './types/table';
import {
  SPREADSHEETS_COLUMNS,
  SPREADSHEETS_COLUMNS_INVERTED,
} from './types/table';

export abstract class Table<T extends Partial<Record<Columns, Field>> = {}> {
  private client: import('google-auth-library').JWT | null = null;
  private initiated = false;
  private gsapi: ReturnType<typeof google.sheets> | null = null;
  private __invertedScheme: Record<Values<T>, Field>;

  constructor(
    private scheme: T,
    private options: { tableId: string; email: string; privateKey: string },
  ) {
    this.__invertedScheme = Object.keys(this.scheme).reduce((acc, k) => {
      // @ts-expect-error ok
      acc[this.scheme[k as keyof typeof this.scheme]] = k;
      return acc;
    }, {} as Record<Values<T>, Field>);
    this.client = new google.auth.JWT(
      this.options.email,
      undefined,
      this.options.privateKey,
      ['https://www.googleapis.com/auth/spreadsheets'],
    );
  }

  public async init() {
    return await new Promise((resolve) => {
      if (!this.client) {
        throw new Error(`Google api client was not created in constructor...`);
      }
      if (this.initiated) {
        return resolve(true);
      }

      this.client.authorize((err) => {
        if (err) {
          this.initiated = false;
          console.log(err);
          throw new Error(err.message);
        }
        this.initiated = true;
        this.gsapi = google.sheets({ version: 'v4', auth: this.client! });
        return resolve(true);
      });
    });
  }

  async count() {
    const opt = {
      spreadsheetId: this.options.tableId,
      range: 'A1:A',
    };

    const data = await this.gsapi!.spreadsheets.values.get(opt);
    const nonEmptyRows = (data.data.values || []).filter(
      (row) => row[0] !== '',
    ).length;

    return nonEmptyRows;
  }

  private mapper(row: MapperValues): RowValues<T> {
    return Object.keys(row).reduce((acc, item) => {
      const value = row[item as Keys<typeof row>];
      const columnName = this.scheme[item as Keys<T>];
      if (columnName) {
        // @ts-expect-error it's fine
        acc[columnName] = value;
      }
      return acc;
    }, {} as RowValues<T>);
  }

  async list(
    options: Partial<{ limit: number; offset: number }> = {},
  ): Promise<RowValues<T>[]> {
    const count =
      typeof options.limit === 'number' ? options.limit : await this.count();
    const offset = typeof options.offset === 'number' ? options.offset + 1 : 1;

    if (count === 0) {
      return [];
    }

    const opt = {
      spreadsheetId: this.options.tableId,
      range: `A${offset}:D${count}`,
    };

    let data = await this.gsapi!.spreadsheets.values.get(opt);

    if (!data) {
      // @ts-expect-error it's ok
      data = { data: { values: [] } };
    }

    return (
      data.data.values
        ?.map((row, index) => {
          const tableRowIndex = index + 1;
          const result = row.reduce((acc, item, index) => {
            const col = SPREADSHEETS_COLUMNS_INVERTED[index as ColumnIndexes];
            acc[col] = item;
            return acc;
          }, {} as Record<Columns, string>);

          result.__tableRowIndex = tableRowIndex;
          return result;
        })
        .map((values: MapperValues) => {
          return {
            ...this.mapper(values),
            __tableRowIndex: values.__tableRowIndex,
          };
        }) || []
    );
  }
  private getCellsForUpdate(
    rows: RowValues<T>[],
    updateData: Partial<Record<Values<T>, Field>>,
  ): UpdatableData {
    return rows.reduce((acc, row) => {
      const rowIndex = row['__tableRowIndex'];
      const keys = Object.keys(row).filter((k) => k !== '__tableRowIndex');
      keys
        // @ts-expect-error keys are exists
        .map((k) => [`${this.__invertedScheme[k]}${rowIndex}`, updateData[k]])
        .forEach((kv) => {
          acc[kv[0]] = kv[1];
        });

      return acc;
    }, {} as UpdatableData);
  }

  private filterData(options: {
    where: Partial<Record<Values<T>, Field>>;
    rows: RowValues<T>[];
  }) {
    const { rows = [], where = {} } = options;

    return rows.filter((row) =>
      Object.keys(where).every((key) => {
        // @ts-expect-error keys are exists
        return options.where[key] === row[key];
      }),
    );
  }

  async update(options: {
    where: Partial<Record<Values<T>, Field>>;
    data: Partial<Record<Values<T>, Field>>;
    rows?: RowValues<T>[];
  }): Promise<boolean> {
    const data = options.rows ?? (await this.list());
    if (data.length === 0) {
      return false;
    }

    const cellsToUpdate = this.getCellsForUpdate(
      this.filterData({ rows: data, where: options.where }),
      options.data,
    );

    const updates: Promise<any>[] = [];

    Object.keys(cellsToUpdate).forEach((cell) => {
      updates.push(
        this.gsapi!.spreadsheets.values.update({
          spreadsheetId: this.options.tableId,
          range: cell,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[cellsToUpdate[cell as Keys<typeof cellsToUpdate>]]],
          },
        }),
      );
    });
    await Promise.all(updates);
    return true;
  }

  async removeRowByIndex(index: number) {
    return await this.gsapi!.spreadsheets.batchUpdate({
      spreadsheetId: this.options.tableId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                dimension: 'ROWS',
                startIndex: index,
                endIndex: index + 1,
              },
            },
          },
        ],
      },
    });
  }

  async remove(options: {
    where: Partial<Record<Values<T>, Field>>;
    rows?: RowValues<T>[];
  }): Promise<boolean> {
    const data = options.rows ?? (await this.list());
    if (data.length === 0) {
      return false;
    }
    const rowsToRemove = this.filterData({ rows: data, where: options.where });
    const rowsIndexes = rowsToRemove.map((r) => r.__tableRowIndex);
    await Promise.all(
      rowsIndexes.map((index) => this.removeRowByIndex(index - 1)),
    );
    return true;
  }

  async append(options: { data: Record<Values<T>, Field> }) {
    const { data = {} } = options;
    const values = Object.keys(data).reduce<string[]>((acc, key) => {
      const _k = key as Keys<typeof data>;
      const val = data[_k];
      const col = this.__invertedScheme[_k] as Keys<
        typeof SPREADSHEETS_COLUMNS
      >;
      const ind: number = SPREADSHEETS_COLUMNS[col];
      if (typeof ind === 'number') {
        acc[ind] = val;
      }
      return acc;
    }, []);

    await this.gsapi!.spreadsheets.values.append({
      spreadsheetId: this.options.tableId,
      valueInputOption: 'USER_ENTERED',
      range: 'A1:A',
      requestBody: {
        values: [values], // [ [ "Avalue", "Bvalue", "Cvalue"... ] ]
      },
    });
  }
}
