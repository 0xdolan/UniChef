// SPDX-License-Identifier: GPL-3.0-or-later
/** Unit tests for the core foundation: codecs, JSON, coercion, recipes and the runner. */

import { describe, expect, it } from 'vitest';

import * as b64 from '../src/dish/base64.js';
import { canCoerce, coerce, parseInteger, tableToTsv } from '../src/dish/coerce.js';
import { fromPlain, jsonDumps, jsonLoads, toPlain } from '../src/dish/json.js';
import type { Dish } from '../src/dish/types.js';
import { decode, encode, scrub } from '../src/dish/utf8.js';
import { UniChefError, quoteInput, type WarningCode } from '../src/errors.js';
import { allOperations, getOperation } from '../src/ops/registry.js';
import { Args, BytesValue, DEFAULT_LIMITS, OpContext, Rng, pyRepr } from '../src/ops/types.js';
import { bake, dishSize, runOperation } from '../src/recipe/run.js';
import { parseRecipe, resolveArgs } from '../src/recipe/validate.js';

const bytes = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));
const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

async function code(p: Promise<unknown> | (() => unknown)): Promise<string> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (exc) {
    if (exc instanceof UniChefError) {
      return exc.code;
    }
    throw exc;
  }
  return 'ok';
}

describe('utf8', () => {
  it.each([
    ['c080', '\uFFFD\uFFFD'],
    ['eda080', '\uFFFD\uFFFD\uFFFD'],
    ['f4908080', '\uFFFD\uFFFD\uFFFD\uFFFD'],
    ['e08041', '\uFFFD\uFFFDA'],
    ['e282', '\uFFFD'],
    ['f09f98', '\uFFFD'],
    ['efbbbf41', '\uFEFFA'],
    ['f09f9880c3a9', '😀é'],
    ['ff', '\uFFFD'],
  ])('decodes %s', (input, want) => {
    expect(decode(bytes(input))).toBe(want);
  });

  it('decodes long input in pieces and checks for cancellation', () => {
    let checks = 0;
    const big = new Uint8Array(200_000).fill(0x61);
    expect(decode(big, () => (checks += 1))).toBe('a'.repeat(200_000));
    expect(checks).toBeGreaterThan(0);
  });

  it('encodes every length and replaces lone surrogates', () => {
    expect(hex(encode('aé€😀'))).toBe('61c3a9e282acf09f9880');
    expect(hex(encode('\uD800x\uDC00'))).toBe('efbfbd78efbfbd');
    expect(scrub('a\uD800\uD83D\uDE00\uDC00')).toBe('a\uFFFD😀\uFFFD');
  });
});

describe('base64 (Python validate=True)', () => {
  it.each([
    ['', ''],
    ['YQ==', '61'],
    ['YWI=', '6162'],
    ['YWJj', '616263'],
    ['YWJj=', '616263'],
    ['YR==', '61'],
  ])('accepts %j', (input, want) => {
    const out = b64.decode(input);
    expect(out === null ? null : hex(out)).toBe(want);
  });

  it.each(['YQ', 'YQ=', 'Y', 'Y===', 'YQ==YQ==', 'Y Q=='])('rejects %j', (input) => {
    expect(b64.decode(input)).toBeNull();
  });

  it('encodes with padding', () => {
    expect(b64.encode(bytes('616263'))).toBe('YWJj');
    expect(b64.encode(bytes('6162'))).toBe('YWI=');
    expect(b64.encode(bytes('61'))).toBe('YQ==');
  });
});

describe('json', () => {
  it('matches Python on order, duplicates, numbers and surrogates', () => {
    const warnings: string[] = [];
    const value = jsonLoads(
      ' {"b":1,"a":[1.5,-0,1e400,"\\ud800\\u00e9",12345678901234567890],"b":null} ',
      (c, m) => warnings.push(`${c} ${m}`),
    );
    expect(jsonDumps(value)).toBe('{"a":[1.5,0,null,"\\ud800é",12345678901234567890],"b":null}');
    expect(warnings).toEqual(['W_DUPLICATE_KEY Duplicate JSON key "b".']);
  });

  it('keeps integer-like keys in order and parses every literal', () => {
    const text =
      '{"2":true,"1":false,"x":null,"e":[],"o":{},"s":"\\"\\\\\\/\\b\\f\\n\\r\\t\\ud83d\\ude00"}';
    expect(jsonDumps(jsonLoads(text))).toBe(
      '{"2":true,"1":false,"x":null,"e":[],"o":{},"s":"\\"\\\\/\\b\\f\\n\\r\\t😀"}',
    );
    expect(jsonDumps(jsonLoads('-12.5e-3'))).toBe('-0.0125');
  });

  it.each([
    '',
    '01',
    '[1,]',
    '{"a" 1}',
    '{"a":1,}',
    '{a:1}',
    'NaN',
    'Infinity',
    '\uFEFF1',
    '"\u0001"',
    '"\\x"',
    '"\\u12"',
    '"abc',
    'tru',
    '[1 2]',
    '{"a":1 "b":2}',
    '1 2',
    '\u00a01',
    '-',
    '1'.repeat(4301),
  ])('rejects %j', async (text) => {
    expect(await code(() => jsonLoads(text))).toBe('E_INPUT_TYPE');
  });

  it('limits nesting depth', async () => {
    expect(await code(() => jsonLoads('['.repeat(1000) + ']'.repeat(1000)))).toBe('E_LIMIT');
    expect(await code(() => jsonLoads('{"a":'.repeat(1000) + '1' + '}'.repeat(1000)))).toBe(
      'E_LIMIT',
    );
  });

  it('converts to and from plain data', () => {
    const plain = { a: [1, 'x', null, true, { b: 2n }] };
    expect(toPlain(fromPlain(plain))).toEqual(plain);
    expect(jsonDumps(fromPlain(new Map([['k', 1]])))).toBe('{"k":1}');
    expect(() => fromPlain(undefined)).toThrow(TypeError);
  });
});

describe('coercion', () => {
  const s = (value: string): Dish => ({ type: 'string', value });

  it('parses integers strictly', async () => {
    expect(parseInteger('-120')).toBe(-120n);
    for (const bad of ['', '-', '+1', '01', '-0', '1.0', '١']) {
      expect(await code(() => parseInteger(bad))).toBe('E_INPUT_TYPE');
    }
  });

  it('follows the shortest route', () => {
    expect(coerce(s('12'), 'integer').value).toBe(12n);
    expect(coerce({ type: 'integer', value: 5n }, 'bytes').value).toEqual(bytes('35'));
    expect(coerce({ type: 'float', value: 1e21 }, 'string').value).toBe('1e+21');
    expect(coerce({ type: 'codepoints', value: [0x61, 0xd800, 0x1f600] }, 'string').value).toBe(
      'a\uFFFD😀',
    );
    expect(coerce(s('a😀'), 'codepoints').value).toEqual([0x61, 0x1f600]);
    expect(jsonDumps(coerce(s('{"a":1}'), 'json').value as never)).toBe('{"a":1}');
    expect(coerce(s('x'), 'string').value).toBe('x');
  });

  it('renders tables as TSV and JSON', () => {
    const table = {
      columns: ['a\tb', 'c'],
      rows: [
        [null, true],
        [1.5, 'x\\\n\r'],
      ],
    };
    expect(tableToTsv(table)).toBe('a\\tb\tc\n\ttrue\n1.5\tx\\\\\\n\\r');
    expect(coerce({ type: 'table', value: table }, 'string').value).toBe(tableToTsv(table));
    expect(jsonDumps(coerce({ type: 'table', value: table }, 'json').value as never)).toBe(
      '{"columns":["a\\tb","c"],"rows":[[null,true],[1.5,"x\\\\\\n\\r"]]}',
    );
    expect(coerce({ type: 'table', value: { columns: [], rows: [[false]] } }, 'string').value).toBe(
      '\nfalse',
    );
  });

  it('refuses impossible routes', async () => {
    expect(canCoerce('json', 'table')).toBe(false);
    expect(canCoerce('bytes', 'json')).toBe(true);
    expect(await code(() => coerce(s('1'), 'table'))).toBe('E_INPUT_TYPE');
  });

  it('measures dishes', () => {
    expect(dishSize({ type: 'json', value: null })).toBe(0);
    expect(dishSize({ type: 'table', value: { columns: ['a'], rows: [[1], [2]] } })).toBe(2);
  });
});

describe('errors and helpers', () => {
  it('quotes input to 64 UTF-8 bytes', () => {
    expect(quoteInput('abc')).toBe("'abc'");
    expect(quoteInput('é'.repeat(40))).toBe(`'${'é'.repeat(32)}'…`);
    expect(quoteInput('😀'.repeat(17))).toBe(`'${'😀'.repeat(16)}'…`);
  });

  it('serialises errors with paths', () => {
    const err = new UniChefError('E_DECODE', 'bad', [1], { at: 3 }).withPrefix('branch', 0);
    expect(err.exitCode).toBe(1);
    expect(err.toJSON()).toEqual({
      code: 'E_DECODE',
      message: 'bad',
      path: 'branch/0/1',
      detail: { at: 3 },
    });
    expect(new UniChefError('E_USAGE', 'x').toJSON()).toEqual({ code: 'E_USAGE', message: 'x' });
  });

  it('reprs strings like Python', () => {
    expect(pyRepr('a')).toBe("'a'");
    expect(pyRepr("it's")).toBe('"it\'s"');
    expect(pyRepr('\'"')).toBe("'\\'\"'");
    expect(pyRepr('\\\n\r\t\u0001\u007f\uD800é')).toBe("'\\\\\\n\\r\\t\\x01\\x7f\\ud800é'");
  });

  it('decodes bytes arguments', async () => {
    expect(hex(new BytesValue('hex', ' 0a FF ').decode('k'))).toBe('0aff');
    expect(hex(new BytesValue('utf8', 'é').decode('k'))).toBe('c3a9');
    expect(hex(new BytesValue('base64', 'YQ==').decode('k'))).toBe('61');
    expect(hex(new BytesValue('latin1', 'ÿ').decode('k'))).toBe('ff');
    for (const [enc, value] of [
      ['hex', 'a'],
      ['hex', 'zz'],
      ['base64', 'Y'],
      ['latin1', 'Ā'],
    ] as const) {
      expect(await code(() => new BytesValue(enc, value).decode('k'))).toBe('E_ARG_INVALID');
    }
  });

  it('generates seeded random bytes like the Python core', () => {
    const rng = new Rng('000102030405060708090a0b0c0d0e0f');
    expect(rng.seeded).toBe(true);
    const first = rng.randomBytes(40);
    expect(hex(first)).toBe(
      '818638ad150c9042a99f4e43bfd0f1b48bc7691645acb2cf9bc774869cd62b09112ac280cda01f4c',
    );
    const os = new Rng();
    expect(os.seeded).toBe(false);
    expect(os.randomBytes(70_000)).toHaveLength(70_000);
  });

  it('cancels through the abort signal', async () => {
    const ac = new AbortController();
    const ctx = new OpContext({ signal: ac.signal });
    expect(ctx.cancelled).toBe(false);
    ac.abort();
    expect(await code(ctx.check)).toBe('E_CANCELLED');
    expect(await code(() => new OpContext().runNested([], { type: 'string', value: '' }))).toBe(
      'E_INTERNAL',
    );
  });

  it('reports missing arguments as internal errors', async () => {
    expect(await code(() => new Args(new Map()).text('x'))).toBe('E_INTERNAL');
  });
});

describe('registry', () => {
  it('lists operations sorted and rejects unknown ids', async () => {
    const ids = allOperations().map((op) => op.id);
    expect(ids).toEqual([...ids].sort());
    expect(getOperation('fork').category).toBe('Flow');
    expect(await code(() => getOperation('nope'))).toBe('E_OP_UNKNOWN');
  });
});

const recipe = (steps: unknown[], extra: Record<string, unknown> = {}): unknown => ({
  version: 1,
  steps,
  ...extra,
});

describe('recipe validation', () => {
  it.each<[string, unknown]>([
    ['not an object', []],
    ['unknown property', { version: 1, steps: [], x: 1 }],
    ['bad version', { version: 2, steps: [] }],
    ['boolean version', { version: true, steps: [] }],
    ['name type', recipe([], { name: 1 })],
    ['long name', recipe([], { name: 'x'.repeat(201) })],
    ['long description', recipe([], { description: 'x'.repeat(5001) })],
    ['bad seed', recipe([], { seed: 'ABC' })],
    ['steps type', { version: 1, steps: {} }],
    ['step type', recipe([1])],
    ['step property', recipe([{ op: 'label', args: { name: 'a' }, extra: 1 }])],
    ['op id', recipe([{ op: 'Label' }])],
    ['args type', recipe([{ op: 'label', args: [] }])],
    ['disabled type', recipe([{ op: 'label', disabled: 1 }])],
    ['label pattern', recipe([{ op: 'comment', label: '1x' }])],
    ['comment length', recipe([{ op: 'comment', comment: 'x'.repeat(2001) }])],
    ['too many steps', recipe(Array.from({ length: 1001 }, () => ({ op: 'comment' })))],
    [
      'duplicate label',
      recipe([
        { op: 'label', args: { name: 'a' } },
        { op: 'comment', label: 'a' },
      ]),
    ],
    ['missing jump target', recipe([{ op: 'jump', args: { to: 'nowhere' } }])],
  ])('rejects %s', async (_name, raw) => {
    expect(await code(() => parseRecipe(raw))).toBe('E_RECIPE_SCHEMA');
  });

  it('rejects deep nesting and unknown ops', async () => {
    let steps: unknown[] = [];
    for (let i = 0; i < 8; i += 1) {
      steps = [{ op: 'sub-recipe', args: { steps } }];
    }
    expect(await code(() => parseRecipe(recipe(steps)))).toBe('E_LIMIT');
    expect(await code(() => parseRecipe(recipe([{ op: 'nope' }])))).toBe('E_OP_UNKNOWN');
  });

  it.each<[string, unknown]>([
    ['unknown', { zzz: 1 }],
    ['string type', { to: 1 }],
    ['integer type', { to: 'a', max: true }],
    ['float', { to: 'a', max: 1.5 }],
    ['below min', { to: 'a', max: -1 }],
    ['above max', { to: 'a', max: 1001 }],
    ['huge string', { to: 'a', max: '99999999999999999999' }],
    ['huge negative', { to: 'a', max: '-99999999999999999999' }],
    ['unsafe number', { to: 'a', max: 2 ** 60 }],
    ['bigint out of range', { to: 'a', max: 2n ** 60n }],
  ])('rejects jump argument: %s', async (_name, args) => {
    const op = getOperation('jump');
    expect(await code(() => resolveArgs(op, args))).toBe('E_ARG_INVALID');
  });

  it('accepts integer spellings', () => {
    const op = getOperation('jump');
    expect(resolveArgs(op, { to: 'a', max: '7' }).get('max')).toBe(7);
    expect(resolveArgs(op, { to: 'a', max: 8n }).get('max')).toBe(8);
    expect(resolveArgs(op, { to: 'a', max: -0 }).get('max')).toBe(0);
    expect(resolveArgs(op, undefined).get('max')).toBe(10);
  });

  it('checks the steps argument and fills defaults', async () => {
    const op = getOperation('fork');
    expect(await code(() => resolveArgs(op, { steps: 'x' }))).toBe('E_ARG_INVALID');
    expect(resolveArgs(op, {}).get('steps')).toEqual([]);
    expect(resolveArgs(op, {}).get('split')).toBe('\n');
  });

  it('parses a full recipe', () => {
    const r = parseRecipe(
      recipe(
        [{ op: 'comment', args: { text: 'x' }, comment: 'c', label: 'top', disabled: false }],
        { name: 'n', description: 'd', seed: '0'.repeat(32) },
      ),
    );
    expect(r.name).toBe('n');
    expect(r.steps[0]?.label).toBe('top');
  });
});

describe('runner', () => {
  const str = (value: string): Dish => ({ type: 'string', value });

  it('loops with jump until the limit and warns once', async () => {
    const result = await bake(
      parseRecipe(
        recipe([
          { op: 'label', args: { name: 'top' } },
          { op: 'comment', args: { text: 'x' } },
          { op: 'jump', args: { to: 'top', max: 2 } },
        ]),
      ),
      str('a'),
    );
    expect(result.dish).toEqual(str('a'));
    expect(result.warnings.map((w) => w.code)).toEqual<WarningCode[]>(['W_JUMP_LIMIT']);
    expect(result.warnings[0]?.message).toBe('Jump to top reached its limit of 2; continuing.');
    expect(result.warnings[0]?.path).toEqual([2]);
    expect(result.stepsExecuted).toBe(9);
  });

  it('skips disabled steps and stops at until or a breakpoint', async () => {
    const r = parseRecipe(
      recipe([
        { op: 'jump', args: { to: 'end' }, disabled: true },
        { op: 'comment', breakpoint: true },
        { op: 'label', args: { name: 'end' } },
      ]),
    );
    expect((await bake(r, str('x'), { breakpoints: true })).stoppedAt).toBe(1);
    expect((await bake(r, str('x'), { until: 2 })).stoppedAt).toBe(2);
    const full = await bake(r, str('x'));
    expect(full.stoppedAt).toBeNull();
    expect(full.stepsExecuted).toBe(2);
  });

  it('reports every executed step through onStep', async () => {
    const events: { path: readonly unknown[]; dish: Dish }[] = [];
    const r = parseRecipe(
      recipe([
        { op: 'comment' },
        { op: 'comment', disabled: true },
        { op: 'sub-recipe', args: { steps: [{ op: 'label', args: { name: 'x' } }] } },
      ]),
    );
    await bake(r, str('a'), {
      onStep: (e) => {
        expect(e.ms).toBeGreaterThanOrEqual(0);
        events.push({ path: e.path, dish: e.dish });
      },
    });
    expect(events.map((e) => e.path)).toEqual([[0], [2, 0], [2]]);
    expect(events.every((e) => e.dish.type === 'string')).toBe(true);
    const viaOp = await runOperation('fork', {}, str('a'), {
      onStep: (e) => events.push({ path: e.path, dish: e.dish }),
    });
    expect(viaOp.dish).toEqual(str('a'));
    expect(events.at(-1)?.path).toEqual([0]);
  });

  it('enforces the step and input limits', async () => {
    const loop = parseRecipe(
      recipe([
        { op: 'label', args: { name: 'a' } },
        { op: 'jump', args: { to: 'a', max: 1000 } },
      ]),
    );
    const limits = { ...DEFAULT_LIMITS, maxSteps: 50 };
    expect(await code(bake(loop, str(''), { limits }))).toBe('E_LIMIT');
    const tiny = { ...DEFAULT_LIMITS, maxInputSize: 2 };
    expect(await code(bake(loop, str('abc'), { limits: tiny }))).toBe('E_LIMIT');
  });

  it('runs fork branches and sub-recipes, keeping the dish type', async () => {
    const forked = await runOperation('fork', { split: ',', merge: ';' }, str('a,b'));
    expect(forked.dish).toEqual(str('a;b'));
    const chars = await runOperation('fork', { split: '', merge: '-' }, str('a😀'));
    expect(chars.dish).toEqual(str('a-😀'));
    const grouped = await bake(
      parseRecipe(recipe([{ op: 'sub-recipe', args: { steps: [{ op: 'comment' }] } }])),
      { type: 'integer', value: 3n },
    );
    expect(grouped.dish).toEqual({ type: 'integer', value: 3n });
    const viaRunner = await runOperation('sub-recipe', {}, str('hi'));
    expect(viaRunner.dish).toEqual(str('hi'));
    const ctx = new OpContext();
    ctx.nested = (_steps, dish) => Promise.resolve(dish);
    const direct = await getOperation('sub-recipe').run(
      bytes('6869'),
      new Args(new Map([['steps', []]])),
      ctx,
    );
    expect(direct).toEqual(bytes('6869'));
  });

  it('runs label and comment directly as byte pass-throughs', async () => {
    for (const op of ['label', 'comment']) {
      const out = await getOperation(op).run(bytes('01'), new Args(new Map()), new OpContext());
      expect(out).toEqual(bytes('01'));
    }
    const jumpRun = getOperation('jump').run('', new Args(new Map()), new OpContext());
    expect(jumpRun).toBe(true);
  });

  it('maps failures to error codes with paths', async () => {
    const ac = new AbortController();
    ac.abort();
    const err = await runOperation('fork', {}, str('a'), { signal: ac.signal }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(UniChefError);
    expect((err as UniChefError).code).toBe('E_CANCELLED');
    expect((err as UniChefError).path).toEqual([]); // checked before the step starts, as in Python
    expect(await code(runOperation('fork', {}, { type: 'json', value: null }))).toBe('ok');
    expect(
      await code(runOperation('fork', {}, { type: 'table', value: { columns: [], rows: [] } })),
    ).toBe('ok');
  });

  it('enforces the output limit', async () => {
    const limits = { ...DEFAULT_LIMITS, minOutputSize: 1, outputFactor: 1 };
    expect(await code(runOperation('fork', { merge: 'xx' }, str('a\nb'), { limits }))).toBe(
      'E_LIMIT',
    );
  });
});
