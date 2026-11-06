// SPDX-License-Identifier: GPL-3.0-or-later
/** Standard Base64 for bytes arguments, matching Python `base64.b64decode(s, validate=True)`. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INDEX = new Map(Array.from(ALPHABET, (c, i) => [c, i]));

/** Decode, or return `null` for input Python rejects. Non-zero trailing bits are ignored. */
export function decode(text: string): Uint8Array | null {
  const m = /^([A-Za-z0-9+/]*)(={0,2})$/.exec(text);
  if (m === null) {
    return null;
  }
  const data = m[1] ?? '';
  const pads = (m[2] ?? '').length;
  const rest = data.length % 4;
  // Padding after a full quad is ignored; a partial quad must be completed by it.
  if (rest === 1 || (rest >= 2 && rest + pads < 4)) {
    return null;
  }
  const out = new Uint8Array(Math.floor((data.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (const c of data) {
    acc = ((acc << 6) | (INDEX.get(c) ?? 0)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** Encode with `=` padding. */
export function encode(data: Uint8Array): string {
  let out = '';
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i] ?? 0;
    const b = data[i + 1];
    const c = data[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(n >> 18) & 63] ?? '';
    out += ALPHABET[(n >> 12) & 63] ?? '';
    out += b === undefined ? '=' : (ALPHABET[(n >> 6) & 63] ?? '');
    out += c === undefined ? '=' : (ALPHABET[n & 63] ?? '');
  }
  return out;
}
