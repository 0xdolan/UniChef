<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# JSON to CSV

Write an array of objects (with a header row) or an array of arrays as CSV. Every record ends with the line ending.

| Id | Input | Output | Background |
|---|---|---|---|
| `json-to-csv` | json | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

JSON to CSV writes an array as RFC 4180 CSV.

- An **array of objects** gets a header row with the keys (in order of first appearance), then
  one row per object. A missing key gives an empty cell.
- An **array of arrays** is written row by row, without a header.
- A field is quoted when it contains the delimiter, a quote or a line break, and quotes inside
  are doubled. Numbers, booleans and `null` are written as text.

**Worked example.** `[{"name":"Ada","city":"London, UK"},{"name":"Bob \"B\"","city":"Paris"}]`
gives

```
name,city
Ada,"London, UK"
"Bob ""B""",Paris
```

Every record ends with the `line_ending`: CRLF by default, as RFC 4180 says, or LF.

## Security notes

A cell that starts with `=`, `+`, `-` or `@` can run as a formula when the file is opened in a
spreadsheet (CSV injection). If the data comes from untrusted users and will be opened in
Excel or a similar program, check for such cells.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `comma` | `comma`, `semicolon`, `tab` |
| `line_ending` | choice | `crlf` | `crlf`, `lf` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `[{"name":"Zoë","note":"a, b"},{"name":"Ali","age":30}]` | `line_ending=lf` | `name,note,age\nZoë,\"a, b\",\nAli,,30\n` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DcoxCsAgDAXQu_xZh665SimltKmkSCJGXMS71_m9gc7VxRS0BXjj4qB9wAoIn5vGZvH2joCrpmUDWZRP1kc0rZNfzHnMHw&i=i65WykvMTVWyUorKP7xaSUcpL78ExEvUUUhSqtWByzrmZAIlE9OBbGOD2lgA), or search for "JSON to CSV" in the operation list.

**CLI:**

```sh
unichef op json-to-csv --arg line_ending=lf '[{"name":"Zoë","note":"a, b"},{"name":"Ali","age":30}]'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("json-to-csv", {"line_ending": "lf"}, Dish.of_string("[{\"name\":\"Zoë\",\"note\":\"a, b\"},{\"name\":\"Ali\",\"age\":30}]"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("json-to-csv", {"line_ending": "lf"}, { type: 'string', value: "[{\"name\":\"Zoë\",\"note\":\"a, b\"},{\"name\":\"Ali\",\"age\":30}]" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4180: CSV](https://www.rfc-editor.org/rfc/rfc4180)
- [OWASP: CSV injection](https://owasp.org/www-community/attacks/CSV_Injection)
- Related: [CSV to JSON](csv-to-json.md), [JSON Minify](json-minify.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← JSON Minify](json-minify.md) · [Contents](../../README.md) · [Levenshtein Distance →](levenshtein-distance.md)
<!-- /docs:nav -->
