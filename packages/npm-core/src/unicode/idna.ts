// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Punycode (RFC 3492) and UTS #46 IDNA processing, nontransitional (PRD §3.8).
 *
 * Errors are collected as [label number, reason] pairs in a fixed order, so both cores
 * report the same first error: labels in order, each stopping at its first failed check,
 * then the bidi rule over all labels, then the DNS lengths (ToASCII only). Strings are
 * handled as code-point arrays so that indexes and lengths match the Python core.
 */

import { UniChefError } from '../errors.js';
import { fromCodePoints, load, once, RangeTable, toCodePoints } from './data.js';
import { normalize } from './normalize.js';
import * as props from './props.js';

// --- Punycode (RFC 3492 §5) ----------------------------------------------------------

const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 0x80;
const MAXINT = 0x7fffffff; // the RFC's overflow bound, as in most implementations
const DELIMITER = 0x2d;
const DIGITS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SEPARATORS = /[。．｡]/gu; // label separators in domain mode, besides "."
const ACE_PREFIX = 'xn--';
const MAX_CP = 0x10ffff;
const SURROGATE_FIRST = 0xd800;
const SURROGATE_LAST = 0xdfff;
const CHECK_EVERY = 4096;

/** Input that RFC 3492 cannot encode or decode. */
export class PunycodeError extends Error {}

const uplus = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
const isAscii = (cps: readonly number[]): boolean => cps.every((cp) => cp < INITIAL_N);

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / points);
  let k = 0;
  while (d > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

function threshold(k: number, bias: number): number {
  return k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
}

/** 0-35, or BASE for a code point that is not a digit (letters in either case). */
function digitValue(cp: number): number {
  const value = cp < INITIAL_N ? DIGITS.indexOf(String.fromCharCode(cp).toLowerCase()) : -1;
  return value < 0 ? BASE : value;
}

function encodeCodePoints(cps: readonly number[], check?: () => void): string {
  const out: string[] = cps.filter((cp) => cp < INITIAL_N).map((cp) => String.fromCharCode(cp));
  const basic = out.length;
  let handled = basic;
  if (basic > 0) {
    out.push('-');
  }
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  while (handled < cps.length) {
    if (check !== undefined && handled % CHECK_EVERY === 0) {
      check();
    }
    let m = Infinity;
    for (const cp of cps) {
      if (cp >= n && cp < m) {
        m = cp;
      }
    }
    if (m - n > Math.floor((MAXINT - delta) / (handled + 1))) {
      throw new PunycodeError('The input is too long to encode.');
    }
    delta += (m - n) * (handled + 1);
    n = m;
    for (const cp of cps) {
      if (cp < n) {
        delta += 1;
        if (delta > MAXINT) {
          throw new PunycodeError('The input is too long to encode.');
        }
      } else if (cp === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = threshold(k, bias);
          if (q < t) {
            break;
          }
          out.push(DIGITS[t + ((q - t) % (BASE - t))] ?? '');
          q = Math.floor((q - t) / (BASE - t));
        }
        out.push(DIGITS[q] ?? '');
        bias = adapt(delta, handled + 1, handled === basic);
        delta = 0;
        handled += 1;
      }
    }
    delta += 1;
    n += 1;
  }
  return out.join('');
}

/** Encode `text` (any code points) to a Punycode string with lowercase digits. */
export function punycodeEncode(text: string, check?: () => void): string {
  return encodeCodePoints(toCodePoints(text), check);
}

/** Decode a Punycode string. Digits are case-insensitive; basic code points keep case. */
export function punycodeDecode(text: string, check?: () => void): string {
  const input = toCodePoints(text);
  const b = Math.max(input.lastIndexOf(DELIMITER), 0);
  const out = input.slice(0, b);
  if (!isAscii(out)) {
    throw new PunycodeError('A character before the last hyphen is not ASCII.');
  }
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  let pos = b > 0 ? b + 1 : 0;
  while (pos < input.length) {
    if (check !== undefined && out.length % CHECK_EVERY === 0) {
      check();
    }
    const oldI = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (pos >= input.length) {
        throw new PunycodeError('The input ends in the middle of a number.');
      }
      const cp = input[pos] ?? 0;
      const digit = digitValue(cp);
      pos += 1;
      if (digit >= BASE) {
        throw new PunycodeError(`${uplus(cp)} is not a Punycode digit.`);
      }
      if (digit > Math.floor((MAXINT - i) / w)) {
        throw new PunycodeError('A number is too large.');
      }
      i += digit * w;
      const t = threshold(k, bias);
      if (digit < t) {
        break;
      }
      if (w > Math.floor(MAXINT / (BASE - t))) {
        throw new PunycodeError('A number is too large.');
      }
      w *= BASE - t;
    }
    const size = out.length + 1;
    bias = adapt(i - oldI, size, oldI === 0);
    if (Math.floor(i / size) > MAXINT - n) {
      throw new PunycodeError('A number is too large.');
    }
    n += Math.floor(i / size);
    i %= size;
    if (n > MAX_CP || (n >= SURROGATE_FIRST && n <= SURROGATE_LAST)) {
      throw new PunycodeError(`The result would include ${uplus(n)}, not a scalar value.`);
    }
    out.splice(i, 0, n);
    i += 1;
  }
  return fromCodePoints(out);
}

const labelsOf = (domain: string): string[] => domain.replace(SEPARATORS, '.').split('.');

/** Encode each label that has a non-ASCII character as `xn--` plus Punycode. */
export function domainToPunycode(domain: string, check?: () => void): string {
  return labelsOf(domain)
    .map((label) => {
      const cps = toCodePoints(label);
      return isAscii(cps) ? label : ACE_PREFIX + encodeCodePoints(cps, check);
    })
    .join('.');
}

/** Decode each label that starts with `xn--` (any case). */
export function domainFromPunycode(domain: string, check?: () => void): string {
  return labelsOf(domain)
    .map((label) =>
      label.slice(0, 4).toLowerCase() === ACE_PREFIX
        ? punycodeDecode(label.slice(4), check)
        : label,
    )
    .join('.');
}

// --- UTS #46 ------------------------------------------------------------------------

const VALID = 'V';
const IGNORED = 'I';
const DISALLOWED = 'X';
const FULL_STOP = 0x2e;
const HYPHEN = 0x2d;
const ZWNJ = 0x200c;
const ZWJ = 0x200d;
const VIRAMA = 9;
const MAX_DOMAIN = 253;
const MAX_LABEL = 63;
const RTL = new Set(['R', 'AL', 'AN']);
const RTL_ALLOWED = new Set(['R', 'AL', 'AN', 'EN', 'ES', 'CS', 'ET', 'ON', 'BN', 'NSM']);
const LTR_ALLOWED = new Set(['L', 'EN', 'ES', 'CS', 'ET', 'ON', 'BN', 'NSM']);
const STD3 = new Set(toCodePoints('abcdefghijklmnopqrstuvwxyz0123456789-'));
const ACE = toCodePoints(ACE_PREFIX);

export interface Flags {
  readonly checkHyphens: boolean;
  readonly checkBidi: boolean;
  readonly checkJoiners: boolean;
  readonly useStd3AsciiRules: boolean;
}

export const DEFAULT_FLAGS: Flags = {
  checkHyphens: true,
  checkBidi: true,
  checkJoiners: true,
  useStd3AsciiRules: true,
};

type Status = string | readonly number[];
type Errors = [number, string][];

const mapping = once((): [RangeTable, readonly Status[]] => {
  const raw = load('security').idna;
  const index = raw.values.map((_, i) => i);
  return [new RangeTable({ default: -1, values: index, ranges: raw.ranges }), raw.values];
});

/** `V`, `I`, `X` or the mapping, for nontransitional processing. */
export function status(cp: number): Status {
  const [table, values] = mapping();
  const index = table.get(cp) as number;
  return index < 0 ? DISALLOWED : (values[index] ?? DISALLOWED);
}

const joining = once((): RangeTable => new RangeTable(load('security').joiningType));
const jt = (cp: number): string => String(joining().get(cp));
const bc = (cp: number): string => String(props.get('bc', cp));

function mapDomain(domain: string): number[] {
  const out: number[] = [];
  for (const cp of toCodePoints(domain)) {
    const st = status(cp);
    if (st === IGNORED) {
      continue;
    }
    if (typeof st === 'string') {
      out.push(cp);
    } else {
      out.push(...st);
    }
  }
  return out;
}

const startsWith = (cps: readonly number[], prefix: readonly number[]): boolean =>
  prefix.every((cp, i) => cps[i] === cp);

/** RFC 5892 Appendix A.1-A.2: the first ZWNJ or ZWJ not allowed where it is. */
function contextjFails(cps: readonly number[]): number | null {
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i] ?? 0;
    if (cp !== ZWNJ && cp !== ZWJ) {
      continue;
    }
    if (i > 0 && props.ccc(cps[i - 1] ?? 0) === VIRAMA) {
      continue;
    }
    if (cp === ZWJ) {
      return cp;
    }
    let j = i - 1;
    while (j >= 0 && jt(cps[j] ?? 0) === 'T') {
      j--;
    }
    let k = i + 1;
    while (k < cps.length && jt(cps[k] ?? 0) === 'T') {
      k++;
    }
    const before = j >= 0 ? jt(cps[j] ?? 0) : '';
    const after = k < cps.length ? jt(cps[k] ?? 0) : '';
    if (!((before === 'L' || before === 'D') && (after === 'R' || after === 'D'))) {
      return cp;
    }
  }
  return null;
}

/** UTS #46 §4.1 steps 1-8 (bidi is checked later): the first failure, or null. */
function validity(cps: readonly number[], flags: Flags, decoded: boolean): string | null {
  const text = fromCodePoints(cps);
  if (decoded && normalize('NFC', text) !== text) {
    return 'it is not in NFC';
  }
  if (flags.checkHyphens) {
    if (cps[2] === HYPHEN && cps[3] === HYPHEN) {
      return 'it has hyphens in the third and fourth positions';
    }
    if (cps[0] === HYPHEN || cps[cps.length - 1] === HYPHEN) {
      return 'it starts or ends with a hyphen';
    }
  } else if (startsWith(cps, ACE)) {
    return 'it starts with xn--';
  }
  if (cps.includes(FULL_STOP)) {
    return 'it contains a full stop';
  }
  if (cps.length > 0 && props.gc(cps[0] ?? 0).startsWith('M')) {
    return 'it starts with a combining mark';
  }
  for (const cp of cps) {
    if (status(cp) !== VALID) {
      return `${uplus(cp)} is not allowed`;
    }
    if (flags.useStd3AsciiRules && cp < INITIAL_N && !STD3.has(cp)) {
      return `${uplus(cp)} is not a lowercase letter, digit or hyphen`;
    }
  }
  if (flags.checkJoiners) {
    const bad = contextjFails(cps);
    if (bad !== null) {
      return `${uplus(bad)} is not allowed in this context`;
    }
  }
  return null;
}

/** RFC 5893 §2 rules 1-6 for a non-empty label. */
function bidiFails(cps: readonly number[]): boolean {
  const classes = cps.map(bc);
  const first = classes[0] ?? '';
  if (first !== 'L' && first !== 'R' && first !== 'AL') {
    return true;
  }
  let end = classes.length;
  while (end > 0 && classes[end - 1] === 'NSM') {
    end--;
  }
  const last = classes[end - 1] ?? '';
  if (first === 'L') {
    return classes.some((c) => !LTR_ALLOWED.has(c)) || (last !== 'L' && last !== 'EN');
  }
  return (
    classes.some((c) => !RTL_ALLOWED.has(c)) ||
    !['R', 'AL', 'EN', 'AN'].includes(last) ||
    (classes.includes('EN') && classes.includes('AN'))
  );
}

function split(cps: readonly number[]): number[][] {
  const labels: number[][] = [[]];
  for (const cp of cps) {
    if (cp === FULL_STOP) {
      labels.push([]);
    } else {
      labels[labels.length - 1]?.push(cp);
    }
  }
  return labels;
}

/** UTS #46 §4 Processing: the converted labels (as code points) and the errors found. */
export function process(domain: string, flags: Flags): [number[][], Errors] {
  const labels = split(toCodePoints(normalize('NFC', fromCodePoints(mapDomain(domain)))));
  const errors: Errors = [];
  labels.forEach((label, index) => {
    const number = index + 1;
    const decoded = startsWith(label, ACE);
    if (decoded) {
      if (!isAscii(label)) {
        errors.push([number, 'a Punycode label has a non-ASCII character']);
        return;
      }
      let converted: number[];
      try {
        converted = toCodePoints(punycodeDecode(fromCodePoints(label.slice(4))));
      } catch (e) {
        if (!(e instanceof PunycodeError)) {
          throw e;
        }
        errors.push([number, 'it is not valid Punycode']);
        return;
      }
      labels[index] = converted;
      if (isAscii(converted)) {
        errors.push([number, 'a Punycode label decodes to ASCII only']);
        return;
      }
    }
    const reason = validity(labels[index] ?? [], flags, decoded);
    if (reason !== null) {
      errors.push([number, reason]);
    }
  });
  if (flags.checkBidi) {
    // X4_2: an empty label other than a final root label
    labels.forEach((label, index) => {
      if (label.length === 0 && (index < labels.length - 1 || index === 0)) {
        errors.push([index + 1, 'it is empty']);
      }
    });
    if (labels.some((label) => label.some((cp) => RTL.has(bc(cp))))) {
      labels.forEach((label, index) => {
        if (label.length > 0 && bidiFails(label)) {
          // empty labels are X4_2 or the root
          errors.push([index + 1, 'it breaks the bidi rule']);
        }
      });
    }
  }
  return [labels, errors];
}

function fail(errors: Errors): UniChefError {
  const [number, reason] = errors[0] ?? [0, ''];
  const more = errors.length > 1 ? ` (${errors.length - 1} more)` : '';
  const where = number === 0 ? 'the domain name' : `label ${number}`;
  return new UniChefError(
    'E_DECODE',
    `Not a valid domain name (UTS #46): ${where}: ${reason}.${more}`,
  );
}

export function toUnicode(domain: string, flags: Flags): string {
  const [labels, errors] = process(domain, flags);
  if (errors.length > 0) {
    throw fail(errors);
  }
  return labels.map(fromCodePoints).join('.');
}

export function toAscii(
  domain: string,
  flags: Flags,
  verifyDnsLength: boolean,
  check?: () => void,
): string {
  const [cpLabels, errors] = process(domain, flags);
  const labels = cpLabels.map((cps, index) => {
    if (isAscii(cps)) {
      return fromCodePoints(cps);
    }
    try {
      return ACE_PREFIX + encodeCodePoints(cps, check);
    } catch (e) {
      if (!(e instanceof PunycodeError)) {
        throw e;
      }
      errors.push([index + 1, 'it cannot be encoded as Punycode']);
      return fromCodePoints(cps);
    }
  });
  if (verifyDnsLength) {
    const names =
      labels.length > 1 && labels[labels.length - 1] === '' ? labels.slice(0, -1) : labels;
    const total = toCodePoints(names.join('.')).length;
    if (total < 1 || total > MAX_DOMAIN) {
      errors.push([0, `its length is ${total}, not 1 to ${MAX_DOMAIN}`]);
    }
    labels.forEach((label, index) => {
      const length = toCodePoints(label).length;
      if (length < 1 || length > MAX_LABEL) {
        errors.push([index + 1, `its length is ${length}, not 1 to ${MAX_LABEL}`]);
      }
    });
  }
  if (errors.length > 0) {
    throw fail(errors);
  }
  return labels.join('.');
}
