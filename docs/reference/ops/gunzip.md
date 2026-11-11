<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Compression

# Gunzip

Decompress gzip data (RFC 1952), member after member, checking each CRC-32 and length. Anything after the last member that is not another member is an error.

| Id | Input | Output | Background |
|---|---|---|---|
| `gunzip` | bytes | bytes | [Compression](../../learn/compression.md) |
<!-- /docs:head -->

## How it works

Gunzip decompresses gzip data (RFC 1952):

1. Check the magic number `1f 8b` and the method `08`.
2. Skip the optional fields the flags announce: extra field, file name, comment, header CRC.
3. Decompress the DEFLATE data, as [Raw Inflate](raw-inflate.md) does.
4. Check the trailer: the [CRC-32](crc32.md) and the length modulo 2³² of the output.
5. If more bytes follow, they must be another gzip member, which is decompressed and appended
   (as `cat a.gz b.gz` produces).

**Worked example.** The Base64 text `H4sIAAAAAAAA/8tIzcnJBwCGphA2BQAAAA==` with the input format
set to Base64 (or after [From Base64](from-base64.md)) gives `hello`.

A wrong magic number, CRC or length, truncated data, or trailing bytes that are not another
member are `E_DECODE`. Some tools pad gzip files with zero bytes; remove them first.

## Security notes

The output is limited (in the CLI, to the larger of 64 MiB and four times the input). A
decompression bomb stops with `E_LIMIT`.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKL82ryixQ0lFKLEoHClfX1sbWAgA), or search for "Gunzip" in the operation list.

**CLI:**

```sh
unichef op gunzip
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("gunzip", {}, Dish.of_string(""))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("gunzip", {}, { type: 'string', value: "" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1952: gzip](https://www.rfc-editor.org/rfc/rfc1952)
- Related: [Gzip](gzip.md), [From Base64](from-base64.md), [Zlib Inflate](zlib-inflate.md), [Compression](../../learn/compression.md)

<!-- docs:nav -->
---

[← XOR](xor.md) · [Contents](../../README.md) · [Gzip →](gzip.md)
<!-- /docs:nav -->
