<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Compression

# Zlib Inflate

Decompress zlib data (RFC 1950) and check its Adler-32. A preset dictionary is not supported, and no bytes may follow the checksum.

| Id | Input | Output | Background |
|---|---|---|---|
| `zlib-inflate` | bytes | bytes | [Compression](../../learn/compression.md) |
<!-- /docs:head -->

## How it works

Zlib Inflate reads a zlib stream (RFC 1950):

1. Check the 2-byte header: CMF × 256 + FLG must be a multiple of 31, the method must be 8
   (DEFLATE) with a window of at most 32 KiB, and there must be no preset dictionary.
2. Decompress the DEFLATE data, as [Raw Inflate](raw-inflate.md) does.
3. Compare the 4-byte big-endian Adler-32 after the data with the [Adler-32](adler32.md) of the
   output.

**Worked example.** `78 9c cb 48 cd c9 c9 57 c8 40 27 01 68 03 08 b1` gives
`hello hello hello hello`.

A failed header check, a wrong checksum, a truncated stream or bytes after the checksum are
`E_DECODE`, with a message saying which. If the header check fails, the data may be raw
DEFLATE (try [Raw Inflate](raw-inflate.md)) or gzip (starts with `1f 8b`: use
[Gunzip](gunzip.md)).

## Security notes

The output is limited (in the CLI, to the larger of 64 MiB and four times the input), so a
decompression bomb stops with `E_LIMIT` instead of filling memory.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `x\u0001K\u0004\u0000\u0000b\u0000b` | — | `a` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslKqyslM0s3MS8tJLElV0lFKLEoHSlbX1sbWAgA&i=q2D0ZmFgSGJIAgA), or search for "Zlib Inflate" in the operation list.

**CLI:**

```sh
unichef op zlib-inflate $'x\u0001K\u0004\u0000\u0000b\u0000b'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("zlib-inflate", {}, Dish.of_string("x\u0001K\u0004\u0000\u0000b\u0000b"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("zlib-inflate", {}, { type: 'string', value: "x\u0001K\u0004\u0000\u0000b\u0000b" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1950: zlib](https://www.rfc-editor.org/rfc/rfc1950)
- Related: [Zlib Deflate](zlib-deflate.md), [Raw Inflate](raw-inflate.md), [Compression](../../learn/compression.md)

<!-- docs:nav -->
---

[← Zlib Deflate](zlib-deflate.md) · [Contents](../../README.md) · [Cartesian Product →](cartesian-product.md)
<!-- /docs:nav -->
