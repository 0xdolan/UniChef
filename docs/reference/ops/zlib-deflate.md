<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Compression

# Zlib Deflate

Compress to the zlib format (RFC 1950): a 2-byte header, raw DEFLATE and an Adler-32 checksum.

| Id | Input | Output | Background |
|---|---|---|---|
| `zlib-deflate` | bytes | bytes | [Compression](../../learn/compression.md) |
<!-- /docs:head -->

## How it works

The zlib format (RFC 1950) wraps a DEFLATE stream in a 2-byte header and a 4-byte checksum:

| Part | Bytes | Meaning |
|---|---|---|
| CMF | `78` | method 8 (DEFLATE), 32 KiB window |
| FLG | `9c` | compression level hint, plus check bits so that CMF × 256 + FLG is a multiple of 31 |
| data | … | [raw DEFLATE](raw-deflate.md) |
| ADLER32 | 4 bytes, big-endian | [Adler-32](adler32.md) of the uncompressed data |

**Worked example.** `hello hello hello hello` gives
`78 9c cb 48 cd c9 c9 57 c8 40 27 01 68 03 08 b1`: the header, the same 10 DEFLATE bytes as
[Raw Deflate](raw-deflate.md), and the Adler-32 `680308b1`.

The second byte depends on `level`: `78 01` (levels 0–1), `78 5e` (2–5), `78 9c` (6, the
default) and `78 da` (7–9). Those pairs are a reliable sign of zlib data in a hex dump, and
`eJ` at the start of Base64 text is `78 9c`.

zlib is used in PNG image data, PDF `/FlateDecode` streams, Git objects and many network
protocols.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `level` | integer 0 to 9 | `6` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | `level=0` | `78 01 01 02 00 fd ff 48 69 00 fb 00 b2` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslKqyslM0k1JTctJLElV0lFKLEoHSlYr5aSWpeYoWRnU1sbWAgA&i=88gEAA), or search for "Zlib Deflate" in the operation list.

**CLI:**

```sh
unichef op zlib-deflate --arg level=0 Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("zlib-deflate", {"level": 0}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("zlib-deflate", {"level": 0}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1950: zlib](https://www.rfc-editor.org/rfc/rfc1950)
- [zlib home page](https://zlib.net/)
- Related: [Zlib Inflate](zlib-inflate.md), [Adler-32](adler32.md), [Compression](../../learn/compression.md)

<!-- docs:nav -->
---

[← Raw Inflate](raw-inflate.md) · [Contents](../../README.md) · [Zlib Inflate →](zlib-inflate.md)
<!-- /docs:nav -->
