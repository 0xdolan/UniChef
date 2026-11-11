<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# JSON Minify

Write JSON with no whitespace, keeping key order.

| Id | Input | Output | Background |
|---|---|---|---|
| `json-minify` | json | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

JSON Minify parses the input as JSON and writes it with no whitespace between tokens, keeping
the key order. Whitespace inside strings is kept, because it is data.

**Worked example.** A beautified document such as

```json
{
  "b": 1,
  "a": [1, 2]
}
```

becomes `{"b":1,"a":[1,2]}`.

Duplicate keys warn `W_DUPLICATE_KEY` and keep the last value: `{"a":1,"a":2}` becomes
`{"a":2}`. That warning matters for security, since two parsers that disagree on duplicates
(first value versus last) can see different data in the same request.

Minified JSON is smaller to send and store, and is the form a signature or hash is usually
computed over.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `{\n  \"a\": [1, 2.50, \"x\"]\n}` | — | `{"a":[1,2.5,"x"]}` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKKs7P083NzMtMq1TSUUosSgfKVdfWxtYCAA&i=q-ZSUFBKVLJSiDbUUTDSMzXQUVCqUIrlqgUA), or search for "JSON Minify" in the operation list.

**CLI:**

```sh
unichef op json-minify
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("json-minify", {}, Dish.of_string("{\n  \"a\": [1, 2.50, \"x\"]\n}"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("json-minify", {}, { type: 'string', value: "{\n  \"a\": [1, 2.50, \"x\"]\n}" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 8259: JSON](https://www.rfc-editor.org/rfc/rfc8259)
- [An exploration of JSON interoperability vulnerabilities](https://bishopfox.com/blog/json-interoperability-vulnerabilities)
- Related: [JSON Beautify](json-beautify.md), [CSV to JSON](csv-to-json.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← JSON Beautify](json-beautify.md) · [Contents](../../README.md) · [JSON to CSV →](json-to-csv.md)
<!-- /docs:nav -->
