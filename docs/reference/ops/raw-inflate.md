<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Compression

# Raw Inflate

Decompress a raw DEFLATE stream (RFC 1951). The stream must be complete, and no bytes may follow it.

| Id | Input | Output | Background |
|---|---|---|---|
| `raw-inflate` | bytes | bytes | [Compression](../../learn/compression.md) |
<!-- /docs:head -->

## How it works

Raw Inflate decompresses a DEFLATE stream (RFC 1951). It reads block after block: each starts
with a final-block bit and a type (stored, fixed Huffman or dynamic Huffman). It decodes
literals and back-references until the final block ends, copying each back-reference from the
output already produced.

**Worked example.** The bytes `cb 48 cd c9 c9 57 c8 40 27 01` decompress to
`hello hello hello hello`.

The stream must be complete and nothing may follow it. A truncated stream, an invalid code or a
back-reference to before the start of the output (`invalid distance too far back`) is
`E_DECODE`.

Raw DEFLATE appears inside ZIP entries, PDF streams marked `/FlateDecode` (those are usually
zlib: try [Zlib Inflate](zlib-inflate.md) first), WebSocket compression, and in malware,
where PowerShell's `IO.Compression.DeflateStream` hides payloads as Base64 of raw DEFLATE.

## Security notes

A *decompression bomb* expands a few kilobytes into gigabytes. UniChef stops when the output
passes the output limit (in the CLI, the larger of 64 MiB and four times the input) with
`E_LIMIT`, so you can open suspicious data safely.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `K\u0004\u0000` | — | `a` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSizXzcxLy0ksSVXSUUosSgfKVdfWxtYCAA&i=82ZhAAA), or search for "Raw Inflate" in the operation list.

**CLI:**

```sh
unichef op raw-inflate $'K\u0004\u0000'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("raw-inflate", {}, Dish.of_string("K\u0004\u0000"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("raw-inflate", {}, { type: 'string', value: "K\u0004\u0000" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1951: DEFLATE](https://www.rfc-editor.org/rfc/rfc1951)
- [Zip bomb on Wikipedia](https://en.wikipedia.org/wiki/Zip_bomb)
- Related: [Raw Deflate](raw-deflate.md), [Zlib Inflate](zlib-inflate.md), [Gunzip](gunzip.md), [Compression](../../learn/compression.md)

<!-- docs:nav -->
---

[← Raw Deflate](raw-deflate.md) · [Contents](../../README.md) · [Zlib Deflate →](zlib-deflate.md)
<!-- /docs:nav -->
