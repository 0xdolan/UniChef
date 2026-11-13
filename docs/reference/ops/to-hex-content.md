<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Hex Content

Write bytes as Snort content: ASCII letters, digits and spaces stay as they are and every other byte goes between pipes as hex. `special-and-space` also converts spaces, `all` converts everything, and `spaces` puts a space between hex bytes.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-hex-content` | bytes | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

Snort and Suricata rules match bytes with `content:"…"`. Readable bytes are written as they
are and the others as hex between pipes, so the rule stays readable.

ASCII letters, digits and spaces are copied; each run of other bytes becomes one `|…|` group.
`special-and-space` also converts spaces, and `all` writes the whole input as one group.

**Worked example: `GET /a b` followed by CR LF**

`/` (0x2f) and CR LF (0x0d 0x0a) are special, so the result is `GET |2f|a b|0d0a|`. With
`convert=all` and `spaces`, `Hi!` gives `|48 69 21|`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `convert` | choice | `special` | `special`, `special-and-space`, `all` |
| `spaces` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `foo=bar` | — | `foo\|3d\|bar` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNSK3QTc7PK0nNK1HSUUosSgdKV9fWxtYCAA&i=S8vPt01KLAIA), or search for "To Hex Content" in the operation list.

**CLI:**

```sh
unichef op to-hex-content foo=bar
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-hex-content", {}, Dish.of_string("foo=bar"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-hex-content", {}, { type: 'string', value: "foo=bar" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Snort 3 rule writing: content](https://docs.snort.org/rules/options/payload/content)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [From Hex Content](from-hex-content.md)

<!-- docs:nav -->
---

[← To Hex](to-hex.md) · [Contents](../../README.md) · [To Hexdump →](to-hexdump.md)
<!-- /docs:nav -->
