<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Hex Content

Read Snort content: hex between pipes becomes those bytes and the rest is UTF-8.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-hex-content` | string | bytes | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

Each `|…|` group of hex digits (spaces allowed) becomes those bytes. Text outside the pipes
is encoded as UTF-8.

**Worked example: `GET|20 2f|é`**

`GET` gives `47 45 54`, the group gives `20 2f`, and `é` gives its two UTF-8 bytes `c3 a9`:
`GET /é` as text.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `foo\|3d\|bar` | — | `foo=bar` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1c1IrdBNzs8rSc0rUdJRSixKByqorq2NrQUA&i=S8vPrzFOqUlKLAIA), or search for "From Hex Content" in the operation list.

**CLI:**

```sh
unichef op from-hex-content 'foo|3d|bar'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-hex-content", {}, Dish.of_string("foo|3d|bar"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-hex-content", {}, { type: 'string', value: "foo|3d|bar" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Snort 3 rule writing: content](https://docs.snort.org/rules/options/payload/content)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [To Hex Content](to-hex-content.md)

<!-- docs:nav -->
---

[← From Hex](from-hex.md) · [Contents](../../README.md) · [From Hexdump →](from-hexdump.md)
<!-- /docs:nav -->
