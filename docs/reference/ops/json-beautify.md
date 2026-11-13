<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# JSON Beautify

Write JSON with one value per line, like `JSON.stringify(v, null, indent)`. `sort_keys` orders object keys by code point.

| Id | Input | Output | Background |
|---|---|---|---|
| `json-beautify` | json | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

JSON Beautify parses the input as JSON (RFC 8259) and writes it again with one value per line
and nested values indented, like `JSON.stringify(value, null, 2)` in JavaScript.

**Worked example.** `{"b":1,"a":[1,2]}` becomes

```json
{
  "b": 1,
  "a": [
    1,
    2
  ]
}
```

With `sort_keys`, object keys are ordered by code point (`a` before `b`), which makes two
documents easy to compare with a diff. `indent` is `2`, `4` or `tab`.

Invalid JSON fails with a message giving the position. A duplicate key warns
`W_DUPLICATE_KEY` and the last value wins, as in most parsers. Very deep nesting stops with
`E_LIMIT`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `indent` | choice | `2` | `2`, `4`, `tab` |
| `sort_keys` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `{"b":[1,2],"a":{}}` | — | `{\n  \"b\": [\n    1,\n    2\n  ],\n  \"a\": {}\n}` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKKs7P001KTSwtyUyrVNJRSixKB8pW19bG1gIA&i=q1ZKUrKKNtQxitVRSlSyqq6tBQA), or search for "JSON Beautify" in the operation list.

**CLI:**

```sh
unichef op json-beautify '{"b":[1,2],"a":{}}'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("json-beautify", {}, Dish.of_string("{\"b\":[1,2],\"a\":{}}"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("json-beautify", {}, { type: 'string', value: "{\"b\":[1,2],\"a\":{}}" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 8259: JSON](https://www.rfc-editor.org/rfc/rfc8259)
- [MDN: JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
- Related: [JSON Minify](json-minify.md), [JWT Decode](jwt-decode.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Hamming Distance](hamming-distance.md) · [Contents](../../README.md) · [JSON Minify →](json-minify.md)
<!-- /docs:nav -->
