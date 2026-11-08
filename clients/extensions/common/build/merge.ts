// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Manifest overlays (PRD §7.2): objects merge recursively, arrays are replaced, an
 * `{"$append": [...]}` object appends to the base array, and `null` deletes the key.
 */

export type Json = null | boolean | number | string | Json[] | JsonObject;
// A recursive type needs an interface: `Record<string, Json>` would refer to itself.
export interface JsonObject {
  [key: string]: Json;
}

export const isObject = (v: Json | undefined): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isAppend(v: Json): v is { $append: Json[] } {
  return isObject(v) && Object.keys(v).length === 1 && Array.isArray(v['$append']);
}

function mergeValue(base: Json | undefined, overlay: Json, path: string): Json {
  if (isAppend(overlay)) {
    if (base === undefined) return overlay.$append;
    if (!Array.isArray(base)) throw new Error(`${path}: $append needs an array in the base.`);
    return [...base, ...overlay.$append];
  }
  if (isObject(overlay) && isObject(base)) return merge(base, overlay, path);
  if (isObject(overlay)) return merge({}, overlay, path);
  return overlay;
}

/** `overlay` applied to `base`; neither is changed. */
export function merge(base: JsonObject, overlay: JsonObject, path = ''): JsonObject {
  const out = new Map(Object.entries(base));
  for (const [key, value] of Object.entries(overlay)) {
    if (value === null) out.delete(key);
    else out.set(key, mergeValue(base[key], value, `${path}/${key}`));
  }
  return Object.fromEntries(out);
}
