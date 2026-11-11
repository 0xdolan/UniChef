<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Compression

# Raw Deflate

Compress to a raw DEFLATE stream (RFC 1951) with no header or checksum. Level 0 stores the input uncompressed; 1 is fastest and 9 smallest.

| Id | Input | Output | Background |
|---|---|---|---|
| `raw-deflate` | bytes | bytes | [Compression](../../learn/compression.md) |
<!-- /docs:head -->

## How it works

DEFLATE (RFC 1951) is the compression inside gzip, zlib, ZIP, PNG and HTTP `Content-Encoding`.
It combines two ideas:

1. **LZ77**: when bytes repeat, replace the repeat with a *back-reference* (length, distance):
   "copy *length* bytes from *distance* bytes back". Distances reach up to 32 KiB.
2. **Huffman coding**: write common symbols with short bit codes and rare ones with long codes.
   Each block uses either fixed codes defined by the standard or dynamic codes described at the
   start of the block.

**Worked example.** `hello hello hello hello` (23 bytes) becomes 10 bytes:
`cb 48 cd c9 c9 57 c8 40 27 01`. The first `hello ` is written as literals, and the remaining
17 bytes are one back-reference: length 17, distance 6. A back-reference may overlap the text it
produces, which is how a short pattern repeats many times.

`level` trades speed for size: 1 is fastest, 9 searches hardest for matches, and 0 stores the
data in uncompressed blocks. `hi` at level 0 is `01 02 00 fd ff 68 69`: a final stored block
(`01`), the length 2 and its one's complement (`02 00 fd ff`), then the two bytes.

Raw DEFLATE has no header and no checksum. Use [Zlib Deflate](zlib-deflate.md) or
[Gzip](gzip.md) when the receiver must detect corruption.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `level` | integer 0 to 9 | `6` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | `level=0` | `01 02 00 fd ff 48 69` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSizXTUlNy0ksSVXSUUosSgfKVSvlpJal5ihZGdTWxtYCAA&i=88gEAA), or search for "Raw Deflate" in the operation list.

**CLI:**

```sh
unichef op raw-deflate --arg level=0 Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("raw-deflate", {"level": 0}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("raw-deflate", {"level": 0}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1951: DEFLATE](https://www.rfc-editor.org/rfc/rfc1951)
- [An explanation of the DEFLATE algorithm](https://zlib.net/feldspar.html)
- Related: [Raw Inflate](raw-inflate.md), [Zlib Deflate](zlib-deflate.md), [Gzip](gzip.md), [Compression](../../learn/compression.md)

<!-- docs:nav -->
---

[← Gzip](gzip.md) · [Contents](../../README.md) · [Raw Inflate →](raw-inflate.md)
<!-- /docs:nav -->
