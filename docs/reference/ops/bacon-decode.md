<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# Bacon cipher decode

Read Bacon codes as upper-case letters. `01` reads `0` and `1`, `ab` reads `A` and `B` in either case, `case` reads lower-case ASCII letters as 0 and upper-case as 1, and `first-letter` reads each word starting with A to M as 0 and N to Z as 1. Other characters are skipped, every five symbols make a letter, and leftover symbols are ignored. A code past the end of the alphabet is written as `?`.

| Id | Input | Output | Background |
|---|---|---|---|
| `bacon-decode` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

`bacon-decode` reads the input as a stream of two symbols, then turns every five into a
letter. `translation` says what the symbols are:

| `translation` | Symbol 0 | Symbol 1 |
|---|---|---|
| `01` | `0` | `1` |
| `ab` | `A` or `a` | `B` or `b` |
| `case` | a lower-case ASCII letter | an upper-case ASCII letter |
| `first-letter` | a word starting with A–M | a word starting with N–Z |

Other characters are skipped.

**Worked example: `bacON ciPHer` with `case`**

The letters read `00011 00110`. Code 3 is `D` and code 6 is `G`, so the result is `DG`.

A code past the end of the alphabet (24 or more in `standard`) is written as `?`, and fewer
than five symbols left at the end are ignored.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `standard` | `standard`, `complete` |
| `translation` | choice | `01` | `01`, `ab`, `case`, `first-letter` |
| `invert` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `00111 01000` | — | `HI` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKSkzOz9NNSU3OT0lV0lFKLEoHSlbX1sbWAgA&i=MzAwNDRUMDA0MDAAAA), or search for "Bacon cipher decode" in the operation list.

**CLI:**

```sh
unichef op bacon-decode '00111 01000'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("bacon-decode", {}, Dish.of_string("00111 01000"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("bacon-decode", {}, { type: 'string', value: "00111 01000" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Bacon's cipher on Wikipedia](https://en.wikipedia.org/wiki/Bacon%27s_cipher)
- Related: [Bacon cipher encode](bacon-encode.md)

<!-- docs:nav -->
---

[← Atbash](atbash.md) · [Contents](../../README.md) · [Bacon cipher encode →](bacon-encode.md)
<!-- /docs:nav -->
