<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# To Rison

Write a JSON value as Rison, a compact form for URLs: objects as `(key:value)` with keys sorted, arrays as `!(...)`, `!t`, `!f` and `!n` for true, false and null, and strings quoted with `'` only when needed. `object` and `array` drop the outer brackets (O-Rison and A-Rison), and `uri` also escapes the result for a URL.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-rison` | json | string | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

The input is read as JSON and written as Rison:

| JSON | Rison |
|---|---|
| object | `(key:value,…)`, keys sorted by UTF-16 code unit |
| array | `!(value,…)` |
| `true`, `false`, `null` | `!t`, `!f`, `!n` |
| number | as in JavaScript, without `+` in the exponent: `1e21` |
| string | bare when it looks like a word, otherwise in `'…'` with `!` escaping `'` and `!` |

A string is a word when it does not start with `-` or a digit and contains none of
`` '!:(),*@$`` or a space. The empty string is `''`.

`object` and `array` write O-Rison and A-Rison: the same text without the outer `(…)` or
`!(…)`. They need an object or an array. `uri` escapes the Rison text as `encodeURIComponent`
does, but keeps `,` `:` `@` `$` `/` and writes a space as `+`.

**Worked example: `{"b":[1,true],"a":"x y"}`**

The keys are sorted (`a`, `b`). `x y` has a space, so it is quoted. The array becomes
`!(1,!t)`. Result: `(a:'x y',b:!(1,!t))`. With `mode=uri` it is `(a:'x+y',b:!(1,!t))`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `mode` | choice | `value` | `value`, `object`, `array`, `uri` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `{"b":[1,true],"a":"x y"}` | — | `(a:'x y',b:!(1,!t))` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydctyiwGyukoJRalAyWqa2tjawE&i=q1ZKUrKKNtQpKSpNjdVRSlSyUqpQqFSqBQA), or search for "To Rison" in the operation list.

**CLI:**

```sh
unichef op to-rison '{"b":[1,true],"a":"x y"}'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-rison", {}, Dish.of_string("{\"b\":[1,true],\"a\":\"x y\"}"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-rison", {}, { type: 'string', value: "{\"b\":[1,true],\"a\":\"x y\"}" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Rison on GitHub](https://github.com/Nanonid/rison)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [From Rison](from-rison.md)

<!-- docs:nav -->
---

[← Symmetric Difference](symmetric-difference.md) · [Contents](../../README.md) · [Add line numbers →](add-line-numbers.md)
<!-- /docs:nav -->
