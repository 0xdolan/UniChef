<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# Adler-32

Adler-32 (RFC 1950) as 8 hex digits.

| Id | Input | Output | Background |
|---|---|---|---|
| `adler32` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

Adler-32 (RFC 1950) is the checksum at the end of every zlib stream. It keeps two 16-bit sums
modulo 65 521 (the largest prime below 2¹⁶):

- **A** starts at 1 and adds each byte;
- **B** starts at 0 and adds the new A after each byte.

The checksum is B × 65 536 + A, written as 8 hex digits.

**Worked example: `Wikipedia`**

| Byte | `W` 87 | `i` 105 | `k` 107 | `i` 105 | `p` 112 | `e` 101 | `d` 100 | `i` 105 | `a` 97 |
|---|---|---|---|---|---|---|---|---|---|
| A | 88 | 193 | 300 | 405 | 517 | 618 | 718 | 823 | 920 |
| B | 88 | 281 | 581 | 986 | 1503 | 2121 | 2839 | 3662 | 4582 |

B = 4 582 = `11E6` and A = 920 = `0398`, so the checksum is `11e60398`.

Adler-32 is faster than [CRC-32](crc32.md) but weaker, especially on short inputs, where the
sums have not had time to spread over the 16 bits. Like CRC-32, it detects accidents, not
attacks.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Wikipedia` | — | `11e60398` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKTMlJLTI2UtJRSixKB4pX19bG1gIA&i=C8_MzixITclMBAA), or search for "Adler-32" in the operation list.

**CLI:**

```sh
unichef op adler32 Wikipedia
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("adler32", {}, Dish.of_string("Wikipedia"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("adler32", {}, { type: 'string', value: "Wikipedia" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1950 §8.2: the Adler-32 algorithm](https://www.rfc-editor.org/rfc/rfc1950#section-8.2)
- [Adler-32 on Wikipedia](https://en.wikipedia.org/wiki/Adler-32)
- Related: [CRC-32](crc32.md), [Zlib Deflate](zlib-deflate.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← Script Mix Check](script-mix-check.md) · [Contents](../../README.md) · [BLAKE2b →](blake2b.md)
<!-- /docs:nav -->
