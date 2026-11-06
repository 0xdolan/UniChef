// SPDX-License-Identifier: GPL-3.0-or-later
/** Extended grapheme clusters (UAX #29 §3.1.1, rules GB1-GB999; PRD §4.5). */

import { fromCodePoints, toCodePoints } from './data.js';
import * as props from './props.js';

const CONTROL = new Set(['CR', 'LF', 'Control']);
const HANGUL_L_FOLLOW = new Set(['L', 'V', 'LV', 'LVT']);
const HANGUL_V_FOLLOW = new Set(['V', 'T']);
const HANGUL_T_LEAD = new Set(['LVT', 'T']);
const HANGUL_LV_LEAD = new Set(['LV', 'V']);
const CHECK_EVERY = 65536;

/** Context carried across a scan for the rules that look further back than one char. */
class State {
  ri = 0; // Regional_Indicator run length before the current position (GB12/13)
  pict = 0; // 0 none, 1 ExtPict Extend*, 2 ExtPict Extend* ZWJ (GB11)
  incb = 0; // GB9c as of Unicode 18: Linker [Extend|Linker]* x Consonant; 2 = inside

  advance(gcb: string, cp: number): void {
    this.ri = gcb === 'Regional_Indicator' ? this.ri + 1 : 0;
    if (props.has('ExtPict', cp) || (this.pict === 1 && gcb === 'Extend')) {
      this.pict = 1;
    } else if (this.pict === 1 && gcb === 'ZWJ') {
      this.pict = 2;
    } else {
      this.pict = 0;
    }
    const incb = props.get('InCB', cp);
    if (incb === 'Linker') {
      this.incb = 2;
    } else if (!(this.incb !== 0 && incb === 'Extend')) {
      this.incb = 0;
    }
  }
}

function isBreak(prev: string, cur: string, cp: number, state: State): boolean {
  if (prev === 'CR' && cur === 'LF') return false; // GB3
  if (CONTROL.has(prev) || CONTROL.has(cur)) return true; // GB4, GB5
  if (prev === 'L' && HANGUL_L_FOLLOW.has(cur)) return false; // GB6
  if (HANGUL_LV_LEAD.has(prev) && HANGUL_V_FOLLOW.has(cur)) return false; // GB7
  if (HANGUL_T_LEAD.has(prev) && cur === 'T') return false; // GB8
  if (cur === 'Extend' || cur === 'ZWJ' || cur === 'SpacingMark' || prev === 'Prepend') {
    return false; // GB9, GB9a, GB9b
  }
  if (state.incb === 2 && props.get('InCB', cp) === 'Consonant') return false; // GB9c
  if (state.pict === 2 && props.has('ExtPict', cp)) return false; // GB11
  return !(prev === 'Regional_Indicator' && cur === prev && state.ri % 2 === 1); // GB12, 13, 999
}

/** Every grapheme boundary offset, including 0 and `cps.length` (GB1, GB2). */
export function boundaries(cps: readonly number[], check?: () => void): number[] {
  if (cps.length === 0) {
    return [];
  }
  const out = [0];
  const state = new State();
  let prev = String(props.get('GCB', cps[0] ?? 0));
  state.advance(prev, cps[0] ?? 0);
  for (let i = 1; i < cps.length; i++) {
    if (check !== undefined && i % CHECK_EVERY === 0) {
      check();
    }
    const cp = cps[i] ?? 0;
    const cur = String(props.get('GCB', cp));
    if (isBreak(prev, cur, cp, state)) {
      out.push(i);
    }
    state.advance(cur, cp);
    prev = cur;
  }
  out.push(cps.length);
  return out;
}

export function graphemes(text: string, check?: () => void): string[] {
  const cps = toCodePoints(text);
  const edges = boundaries(cps, check);
  const out: string[] = [];
  for (let k = 1; k < edges.length; k++) {
    out.push(fromCodePoints(cps.slice(edges[k - 1], edges[k])));
  }
  return out;
}

export function count(text: string): number {
  return Math.max(0, boundaries(toCodePoints(text)).length - 1);
}
