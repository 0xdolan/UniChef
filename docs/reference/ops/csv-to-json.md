<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# CSV to JSON

Parse RFC 4180 CSV. With `header`, the first record names the fields of an object per record; otherwise each record is an array. Cells stay strings.

| Id | Input | Output | Background |
|---|---|---|---|
| `csv-to-json` | string | json | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

CSV to JSON parses comma-separated values as defined by RFC 4180:

- Records end at a line break (CRLF or LF).
- A field in double quotes may contain the delimiter, line breaks and quotes; a quote inside is
  written twice (`""`).
- Every cell stays a string: `1` is `"1"`, so leading zeros and long numbers are not lost.

With `header` (default), the first record names the fields, and each later record becomes an
object. Without it, each record becomes an array.

**Worked example.**

```
name,city
Ada,"London, UK"
"Bob ""B""",Paris
```

gives `[{"name":"Ada","city":"London, UK"},{"name":"Bob \"B\"","city":"Paris"}]`.

Choose `delimiter=semicolon` for files from spreadsheets in locales that use a decimal comma,
and `tab` for TSV.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `comma` | `comma`, `semicolon`, `tab` |
| `header` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `name,note\r\nZoë,\"say \"\"hi\"\"\"\r\n` | — | `[{"name":"Zoë","note":"say \"hi\""}]` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKLi7TLcnXzSoGSusoJRalA-Wqa2tjawE&i=y0vMTdXJyy9J5eWKyj-8WkepOLFSQUkpI1NJSYmXCwA), or search for "CSV to JSON" in the operation list.

**CLI:**

```sh
unichef op csv-to-json
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("csv-to-json", {}, Dish.of_string("name,note\r\nZoë,\"say \"\"hi\"\"\"\r\n"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("csv-to-json", {}, { type: 'string', value: "name,note\r\nZoë,\"say \"\"hi\"\"\"\r\n" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4180: CSV](https://www.rfc-editor.org/rfc/rfc4180)
- Related: [JSON to CSV](json-to-csv.md), [JSON Beautify](json-beautify.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Cartesian Product](cartesian-product.md) · [Contents](../../README.md) · [Hamming Distance →](hamming-distance.md)
<!-- /docs:nav -->
