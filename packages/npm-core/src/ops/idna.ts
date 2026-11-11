// SPDX-License-Identifier: GPL-3.0-or-later
/** Punycode (RFC 3492) and IDNA (UTS #46, nontransitional) ops (PRD §3.8 Beta; spec/README.md). */

import { UniChefError } from '../errors.js';
import { ready } from '../unicode/data.js';
import * as idna from '../unicode/idna.js';
import { boolArg, defineOp, type Args, type Operation } from './types.js';

const UTS46_ARGS = [
  boolArg('check_hyphens', true),
  boolArg('check_bidi', true),
  boolArg('check_joiners', true),
  boolArg('use_std3_ascii_rules', true),
];

const flags = (args: Args): idna.Flags => ({
  checkHyphens: args.flag('check_hyphens'),
  checkBidi: args.flag('check_bidi'),
  checkJoiners: args.flag('check_joiners'),
  useStd3AsciiRules: args.flag('use_std3_ascii_rules'),
});

function punycode<T>(code: 'E_LIMIT' | 'E_DECODE', prefix: string, call: () => T): T {
  try {
    return call();
  } catch (e) {
    if (e instanceof idna.PunycodeError) {
      throw new UniChefError(code, prefix + e.message);
    }
    throw e;
  }
}

export const toPunycode = defineOp({
  id: 'to-punycode',
  name: 'To Punycode',
  category: 'Encoding',
  description:
    'Encode the input with Punycode (RFC 3492). With `domain`, split it into labels at ' +
    'full stops (U+002E, U+3002, U+FF0E, U+FF61), encode each label that has a non-ASCII ' +
    'character as xn-- plus Punycode, and join the labels with U+002E. No mapping or ' +
    'checks are applied; use idna-to-ascii for that.',
  inputType: 'string',
  outputType: 'string',
  args: [boolArg('domain', false)],
  examples: [
    { input: 'münchen', args: {}, output: 'mnchen-3ya' },
    { input: 'bücher.example', args: { domain: true }, output: 'xn--bcher-kva.example' },
  ],
  run(text, args, ctx) {
    return punycode('E_LIMIT', '', () =>
      args.flag('domain')
        ? idna.domainToPunycode(text, ctx.check)
        : idna.punycodeEncode(text, ctx.check),
    );
  },
});

export const fromPunycode = defineOp({
  id: 'from-punycode',
  name: 'From Punycode',
  category: 'Encoding',
  description:
    'Decode Punycode (RFC 3492). With `domain`, split the input into labels as ' +
    'to-punycode does and decode each label that starts with xn-- (any case).',
  inputType: 'string',
  outputType: 'string',
  args: [boolArg('domain', false)],
  examples: [
    { input: 'mnchen-3ya', args: {}, output: 'münchen' },
    { input: 'xn--bcher-kva.example', args: { domain: true }, output: 'bücher.example' },
  ],
  run(text, args, ctx) {
    return punycode('E_DECODE', 'Invalid Punycode: ', () =>
      args.flag('domain')
        ? idna.domainFromPunycode(text, ctx.check)
        : idna.punycodeDecode(text, ctx.check),
    );
  },
});

export const idnaToAscii = defineOp({
  id: 'idna-to-ascii',
  name: 'IDNA To ASCII',
  category: 'Encoding',
  description:
    'UTS #46 ToASCII with nontransitional processing: map, normalise to NFC, check ' +
    'every label, and encode non-ASCII labels as xn-- plus Punycode. Any error fails the ' +
    'op with E_DECODE, naming the first error found. `verify_dns_length` requires labels ' +
    'of 1 to 63 characters and a name of 1 to 253 (not counting a final dot).',
  inputType: 'string',
  outputType: 'string',
  args: [...UTS46_ARGS, boolArg('verify_dns_length', true)],
  examples: [
    { input: 'Bücher.Example', args: {}, output: 'xn--bcher-kva.example' },
    { input: 'faß.de', args: {}, output: 'xn--fa-hia.de' },
  ],
  async run(text, args, ctx) {
    ctx.check();
    await ready('core', 'security');
    return idna.toAscii(text, flags(args), args.flag('verify_dns_length'), ctx.check);
  },
});

export const idnaToUnicode = defineOp({
  id: 'idna-to-unicode',
  name: 'IDNA To Unicode',
  category: 'Encoding',
  description:
    'UTS #46 ToUnicode with nontransitional processing: map, normalise to NFC, decode ' +
    'xn-- labels and check every label. Any error fails the op with E_DECODE, naming the ' +
    'first error found.',
  inputType: 'string',
  outputType: 'string',
  args: UTS46_ARGS,
  examples: [
    { input: 'xn--bcher-kva.example', args: {}, output: 'bücher.example' },
    { input: 'XN--FA-HIA.DE', args: {}, output: 'faß.de' },
  ],
  async run(text, args, ctx) {
    ctx.check();
    await ready('core', 'security');
    return idna.toUnicode(text, flags(args));
  },
});

export const IDNA_OPS: readonly Operation[] = [
  toPunycode,
  fromPunycode,
  idnaToAscii,
  idnaToUnicode,
];
