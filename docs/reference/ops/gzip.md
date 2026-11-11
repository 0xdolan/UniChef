<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Compression

# Gzip

Compress to one gzip member (RFC 1952) with no file name, a zero modification time and OS 255 (unknown), so the output does not depend on when or where it is made.

| Id | Input | Output | Background |
|---|---|---|---|
| `gzip` | bytes | bytes | [Compression](../../learn/compression.md) |
<!-- /docs:head -->

## How it works

Gzip (RFC 1952) wraps a DEFLATE stream with a header and a trailer, for files and HTTP.

**Worked example.** `hello hello hello hello` gives

```
1f 8b 08 00 00 00 00 00 00 ff   header
cb 48 cd c9 c9 57 c8 40 27 01   DEFLATE data
e3 51 3d 8d                     CRC-32, little-endian
17 00 00 00                     size: 23 bytes, little-endian
```

| Header field | Value | Meaning |
|---|---|---|
| ID | `1f 8b` | gzip magic number |
| CM | `08` | DEFLATE |
| FLG | `00` | no file name, comment or extra field |
| MTIME | `00 00 00 00` | no modification time |
| XFL | `00` | no level hint |
| OS | `ff` | unknown |

UniChef writes no file name and a zero time, so the same input always gives the same bytes:
recipes and tests are reproducible. The trailer stores the [CRC-32](crc32.md) (`8d3d51e3`)
and the length modulo 2³², which [Gunzip](gunzip.md) checks.

Base64 of gzip data starts with `H4sI`, a pattern worth recognising in logs, cookies and
malware.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `level` | integer 0 to 9 | `6` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | `level=0` | `1f 8b 08 00 00 00 00 00 00 ff 01 02 00 fd ff 48 69 0e 0e 17 4d 02 00 00 00` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKr8osUNJRSixKBwpWK-WklqXmKFkZ1NbG1gIA&i=88gEAA), or search for "Gzip" in the operation list.

**CLI:**

```sh
unichef op gzip --arg level=0 Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("gzip", {"level": 0}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("gzip", {"level": 0}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1952: gzip](https://www.rfc-editor.org/rfc/rfc1952)
- [MDN: Content-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
- Related: [Gunzip](gunzip.md), [Raw Deflate](raw-deflate.md), [CRC-32](crc32.md), [Compression](../../learn/compression.md)

<!-- docs:nav -->
---

[← Gunzip](gunzip.md) · [Contents](../../README.md) · [Raw Deflate →](raw-deflate.md)
<!-- /docs:nav -->
