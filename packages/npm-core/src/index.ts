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
  type DishValues,
  type JsonObject,
  type JsonValue,
  type Table,
} from './dish/types.js';
export { canCoerce, coerce, parseInteger, tableToTsv } from './dish/coerce.js';
export { formatFloat, fromPlain, jsonDumps, jsonLoads, toPlain, type WarnFn } from './dish/json.js';
export { decode as utf8Decode, encode as utf8Encode, scrub } from './dish/utf8.js';
export { allOperations, getOperation, hasOperation } from './ops/registry.js';
export {
  allOperationInfo,
  getOperationInfo,
  hasOperationInfo,
  type OperationInfo,
} from './ops/catalogue.js';
export {
  Args,
  BytesValue,
  DEFAULT_LIMITS,
  OpContext,
  Rng,
  type ArgSpec,
  type ArgValue,
  type BytesEncoding,
  type Category,
  type Example,
  type Limits,
  type NestedRunner,
  type Operation,
  type ParityClass,
  type PlainJson,
  type Step,
} from './ops/types.js';
export { parseRecipe, resolveArgs, type Recipe } from './recipe/validate.js';
export {
  bake,
  dishSize,
  runOperation,
  type BakeOptions,
  type BakeResult,
  type StepEvent,
} from './recipe/run.js';
export {
  cyberChefOperations,
  importCyberChef,
  parseCyberChef,
  type CyberChefStep,
} from './recipe/cyberchef.js';
export { loadData, setDataSource, type DataSource } from './data/load.js';
