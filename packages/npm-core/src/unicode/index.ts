// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The Unicode engine, computed from the pinned UCD (PRD §4).
 *
 * `await ready()` loads the artefacts; every function below is synchronous after that.
 */

export * as caseMap from './case.js';
export * as confusables from './confusables.js';
export * as data from './data.js';
export * as names from './names.js';
export * as normalize from './normalize.js';
export * as props from './props.js';
export * as query from './query.js';
export * as segment from './segment.js';
export { MAX_CODE_POINT, ready, UCD_VERSION, type Ranges } from './data.js';
