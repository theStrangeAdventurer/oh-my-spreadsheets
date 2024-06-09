import type { JWT } from 'google-auth-library';
import { google } from 'googleapis';

import type {
  ColumnIndexes,
  Columns,
  Field,
  Filterable,
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

export class Table<const T extends Partial<Record<Columns, Field>> = {}> {
  private readonly client: JWT | null = null;
  private initiated = false;
  private gsapi: ReturnType<typeof google.sheets> | null = null;
  private readonly __invertedScheme: Record<Values<T>, Field>;

  constructor(
    /**
     * Table scheme
     * @example {{ A: 'username', B: 'email' } as const}
     * @example {{ A: 'author', B: 'book', C: 'year' } as const}
     */
    private scheme: T,
    private options: {
      /**
       * Table ID from browser url
       * @example {'https://docs.google.com/spreadsheets/d/<TABLE-ID-HERE>/edit'}
       */
      spreadsheetID: string;
      /**
       * Service account EMAIL
       * https://cloud.google.com/iam/docs/service-accounts-create
       */
      email: string;
      /**
       * - The private key can be obtained by adding it to your service account
       * and downloading the JSON file through the "Manage keys" menu item at the following URL:
       * https://console.cloud.google.com/iam-admin/serviceaccounts
       * @example {'-----BEGIN PRIVATE KEY-----\n<VALUE-OF-YOUR-PRIVATE-KEY-HERE>\n-----END PRIVATE KEY-----\n'}
       */
      privateKey: string;
      /**
       * The optional name of the sheet (tab)
       */
      sheet?: string;
    },
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

  private async initCheck() {
    if (this.initiated) {
      return;
    }
    await this.init();
  }

  protected async init() {
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

  public async count() {
    await this.initCheck();
    const opt = {
      spreadsheetId: this.options.spreadsheetID,
      range: `${this.getSheetRange()}A1:Z`,
    };

    const data = await this.gsapi!.spreadsheets.values.get(opt);
    const nonEmptyRows = (data.data.values || []).length;

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

  private getSheetRange() {
    return this.options.sheet ? `${this.options.sheet}!` : '';
  }

  /**
   * Get sheets (tabs) of current spreadsheet
   */
  public async readSheets() {
    await this.initCheck();
    const response = await this.gsapi!.spreadsheets.get({
      spreadsheetId: this.options.spreadsheetID,
    });
    return response.data.sheets;
  }

  public async read(
    options: Partial<
      {
        limit: number;
        offset: number;
      } & Filterable<T>
    > = {},
  ): Promise<RowValues<T>[]> {
    await this.initCheck();
    const count =
      typeof options.limit === 'number' ? options.limit : await this.count();
    const offset = typeof options.offset === 'number' ? options.offset + 1 : 1;

    if (count === 0) {
      return [];
    }

    const opt = {
      spreadsheetId: this.options.spreadsheetID,
      range: `${this.getSheetRange()}A${offset}:Z${count}`,
    };

    let data = await this.gsapi!.spreadsheets.values.get(opt);

    if (!data) {
      // @ts-expect-error it's ok
      data = { data: { values: [] } };
    }

    const result =
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
        }) || [];

    return options.where
      ? this.filterData({ rows: result, where: options.where })
      : result;
  }
  private getCellsForUpdate(
    rows: RowValues<T>[],
    updateData: Partial<Record<Values<T>, Field>>,
  ): UpdatableData {
    const updatableD = rows.reduce((acc, row) => {
      const rowIndex = row.__tableRowIndex;
      const keys = Object.keys(this.__invertedScheme).filter(
        (k) => k !== '__tableRowIndex',
      );
      keys
        // @ts-expect-error keys are exists
        .map((k) => [`${this.__invertedScheme[k]}${rowIndex}`, updateData[k]])
        .forEach((kv) => {
          acc[kv[0]] = kv[1];
        });
      return acc;
    }, {} as UpdatableData);

    return updatableD;
  }

  private filterData(
    options: Filterable<T> & {
      rows: RowValues<T>[];
    },
  ) {
    const { rows = [], where = {} } = options;

    const result = rows.filter((row) => {
      const filterKeys = Object.keys(where);
      return filterKeys.every((key) => {
        // @ts-expect-error keys are exists
        if (!row[key]) row[key] = undefined;
        // @ts-expect-error keys are exists
        return options.where[key] === row[key];
      });
    });
    return result;
  }

  public async update(
    options: Filterable<T> & {
      data: Partial<Record<Values<T>, Field>>;
    },
  ): Promise<boolean> {
    await this.initCheck();
    const data = await this.read();
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
          spreadsheetId: this.options.spreadsheetID,
          range: `${this.getSheetRange()}${cell}`,
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

  public async getSheetID(sheet?: string) {
    await this.initCheck();
    const _sheet = sheet || this.options.sheet;
    const sheets = await this.readSheets();
    return sheets?.find((s) => s.properties?.title === _sheet)?.properties
      ?.sheetId;
  }

  public async deleteRowByIndex(index: number | number[]) {
    await this.initCheck();
    const _indexes = Array.isArray(index) ? index : [index];

    if (_indexes.length === 0) {
      return null;
    }

    _indexes.sort();
    _indexes.reverse();

    const sheetID = await this.getSheetID();

    const deleteDimensions = _indexes.map((index) => ({
      deleteDimension: {
        range: {
          sheetId: sheetID,
          dimension: 'ROWS',
          startIndex: index,
          endIndex: index + 1,
        },
      },
    }));

    const result = await this.gsapi!.spreadsheets.batchUpdate({
      spreadsheetId: this.options.spreadsheetID,
      requestBody: {
        requests: deleteDimensions,
      },
    });
    return result;
  }

  public async delete(options: Partial<Filterable<T>> = {}): Promise<boolean> {
    await this.initCheck();
    const data = await this.read();
    if (data.length === 0) {
      return false;
    }
    const rowsToRemove = options.where
      ? this.filterData({ rows: data, where: options.where })
      : data;
    const rowsIndexes = rowsToRemove.map((r) => r.__tableRowIndex);
    const indexes = rowsIndexes.map((index) => index - 1);
    await this.deleteRowByIndex(indexes);
    return true;
  }

  public async create(options: { data: Record<Values<T>, Field> }) {
    await this.initCheck();
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
      spreadsheetId: this.options.spreadsheetID,
      valueInputOption: 'USER_ENTERED',
      range: `${this.getSheetRange()}A1:A`,
      requestBody: {
        values: [values], // [ [ "Avalue", "Bvalue", "Cvalue"... ] ]
      },
    });
  }
}
