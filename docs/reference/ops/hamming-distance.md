<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Hamming Distance

Split the input on `delimiter` into two samples of equal length, read as UTF-8 text or as hex (whitespace ignored). Write the number of positions where they differ, counting bytes or bits.

| Id | Input | Output | Background |
|---|---|---|---|
| `hamming-distance` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into two samples at `delimiter`. Each is read as UTF-8 text, or as hex when
`input_type` is `hex` (whitespace is ignored; the digits must come in pairs). The two must have
the same number of bytes. The result counts the positions where they differ: whole bytes with
`unit=byte`, single bits with `unit=bit`.

**Worked example: `karolin` and `kathrin`**

| First | k | a | r | o | l | i | n |
|---|---|---|---|---|---|---|---|
| Second | k | a | t | h | r | i | n |
| Differs | | | ✓ | ✓ | ✓ | | |

Byte distance: `3`. In bits, `r`/`t` (`0x72`/`0x74`) differ in 2 bits, `o`/`h` (`0x6f`/`0x68`) in 3 and
`l`/`r` (`0x6c`/`0x72`) in 4, so the bit distance is `9`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | string | `\n\n` | — |
| `unit` | choice | `byte` | `byte`, `bit` |
| `input_type` | choice | `text` | `text`, `hex` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `karolin\n\nkathrin` | — | `3` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKSMzNzcxL103JLC5JzEtOVdJRSixKByqorq2NrQUA&i=y04sys_JzOPiyk4sySjKzAMA), or search for "Hamming Distance" in the operation list.

**CLI:**

```sh
unichef op hamming-distance
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("hamming-distance", {}, Dish.of_string("karolin\n\nkathrin"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("hamming-distance", {}, { type: 'string', value: "karolin\n\nkathrin" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Hamming distance on Wikipedia](https://en.wikipedia.org/wiki/Hamming_distance)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Levenshtein Distance](levenshtein-distance.md), [XOR](xor.md)

<!-- docs:nav -->
---

[← From Rison](from-rison.md) · [Contents](../../README.md) · [JSON Beautify →](json-beautify.md)
<!-- /docs:nav -->
