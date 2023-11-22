export const SPREADSHEETS_COLUMNS = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  F: 5,
  E: 4,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
} as const;

export const SPREADSHEETS_COLUMNS_INVERTED = Object.keys(
  SPREADSHEETS_COLUMNS,
).reduce((acc, col) => {
  acc[SPREADSHEETS_COLUMNS[col as Columns]] = col as Columns;
  return acc;
}, {} as Record<ColumnIndexes, Columns>);

type ColumnsT = typeof SPREADSHEETS_COLUMNS;

export type Keys<T extends object> = keyof T;
export type Values<T extends object> = T[keyof T] extends infer U
  ? U extends string | number | symbol
    ? U
    : never
  : never;
export type Columns = Keys<ColumnsT>;
export type CellLocation = `${Columns}${number}`;
export type UpdatableData = { [k in CellLocation]?: Field };
export type Field = string;
export type ColumnIndexes = Values<ColumnsT>;
export type WithIndex<T extends object> = T & { __tableRowIndex: number };
export type MapperValues = WithIndex<Record<Columns, string>>;
export type SchemeWithIndex<T extends object> = WithIndex<
  Record<Keys<T>, string>
>;
export type RowValues<T extends object> = WithIndex<{
  [k in Values<T>]: Field;
}>;
