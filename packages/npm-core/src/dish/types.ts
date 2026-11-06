// SPDX-License-Identifier: GPL-3.0-or-later
/** Dish values (PRD §3.1). */

export type DishType = 'bytes' | 'string' | 'integer' | 'float' | 'json' | 'codepoints' | 'table';

export const DISH_TYPES: readonly DishType[] = [
  'bytes',
  'string',
  'integer',
  'float',
  'json',
  'codepoints',
  'table',
];

/**
 * A JSON value. Objects are `Map`s so key order survives (plain JS objects move
 * integer-like keys first). Integers outside the safe range are `bigint`.
 */
export type JsonValue = null | boolean | number | bigint | string | JsonValue[] | JsonObject;
export type JsonObject = Map<string, JsonValue>;

export type Cell = null | boolean | number | string;

export interface Table {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly Cell[])[];
}

export interface DishValues {
  bytes: Uint8Array;
  string: string;
  integer: bigint;
  float: number;
  json: JsonValue;
  codepoints: readonly number[];
  table: Table;
}

export type DishValue<T extends DishType = DishType> = DishValues[T];

/** A typed value flowing between recipe steps. */
export type Dish = {
  [T in DishType]: { readonly type: T; readonly value: DishValues[T] };
}[DishType];

export function makeDish<T extends DishType>(type: T, value: DishValues[T]): Dish {
  return { type, value } as Dish;
}

export const ofBytes = (value: Uint8Array): Dish => ({ type: 'bytes', value });
export const ofString = (value: string): Dish => ({ type: 'string', value });
