// SPDX-License-Identifier: GPL-3.0-or-later
/** @unichef/core public API. */

export { VERSION } from './version.js';
export {
  EXIT_CODES,
  UniChefError,
  WARNING_CODES,
  isUniChefError,
  quoteInput,
  type ErrorCode,
  type PathItem,
  type RunWarning,
  type WarningCode,
} from './errors.js';
export {
  DISH_TYPES,
  makeDish,
  ofBytes,
  ofString,
  type Cell,
  type Dish,
  type DishType,
  type DishValue,
  type JsonObject,
  type JsonValue,
  type Table,
} from './dish/types.js';
export { canCoerce, coerce, parseInteger, tableToTsv } from './dish/coerce.js';
export { formatFloat, fromPlain, jsonDumps, jsonLoads, toPlain } from './dish/json.js';
export { decode as utf8Decode, encode as utf8Encode, scrub } from './dish/utf8.js';
export { allOperations, getOperation, hasOperation } from './ops/registry.js';
export {
  Args,
  BytesValue,
  DEFAULT_LIMITS,
  OpContext,
  Rng,
  type ArgSpec,
  type ArgValue,
  type Category,
  type Limits,
  type Operation,
  type ParityClass,
  type Step,
} from './ops/types.js';
export { parseRecipe, resolveArgs, type Recipe } from './recipe/validate.js';
export { bake, dishSize, runOperation, type BakeOptions, type BakeResult } from './recipe/run.js';
