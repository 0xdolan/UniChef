<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# From Rison

Read Rison and write it as JSON. `object` and `array` read O-Rison and A-Rison, where the outer brackets are left out. Whitespace is not allowed between tokens.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-rison` | string | json | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

The input is read as Rison and written as JSON. `(…)` is an object, `!(…)` an array, `!t`,
`!f` and `!n` are true, false and null, `'…'` is a string with `!!` and `!'` as escapes, and
a bare word is a string. A number has JSON's form (`-12`, `1.5`, `2e3`); a whole number stays
an integer of any size.

The reader is strict: whitespace between tokens, a trailing comma, an unknown `!` literal or
text after the value is an error. A key used twice keeps the last value and gives a
`W_DUPLICATE_KEY` warning.

`object` and `array` read O-Rison and A-Rison, which leave out the outer brackets.

**Worked example: `(a:'x y',b:!(1,!t))`**

| Token | JSON |
|---|---|
| `a:'x y'` | `"a": "x y"` |
| `b:!(1,!t)` | `"b": [1, true]` |

Result: `{"a":"x y","b":[1,true]}`. In `object` mode the same value is read from
`a:'x y',b:!(1,!t)`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `mode` | choice | `value` | `value`, `object`, `array` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `(a:'x y',b:!(1,!t))` | — | `{"a":"x y","b":[1,true]}` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1S3KLAbK6iglFqUDpapra2NrAQ&i=00i0Uq9QqFTXSbJS1DDUUSzR1AQA), or search for "From Rison" in the operation list.

**CLI:**

```sh
unichef op from-rison '(a:'"'"'x y'"'"',b:!(1,!t))'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-rison", {}, Dish.of_string("(a:'x y',b:!(1,!t))"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-rison", {}, { type: 'string', value: "(a:'x y',b:!(1,!t))" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Rison on GitHub](https://github.com/Nanonid/rison)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [To Rison](to-rison.md), [JSON Beautify](json-beautify.md)

<!-- docs:nav -->
---

[← CSV to JSON](csv-to-json.md) · [Contents](../../README.md) · [Hamming Distance →](hamming-distance.md)
<!-- /docs:nav -->
