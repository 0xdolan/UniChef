<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Flow

# Conditional jump

Jump to the label `to` when `pattern` matches the dish (or does not, with `invert`), at most `max` times; then continue with a W_JUMP_LIMIT warning.

| Id | Input | Output | Background |
|---|---|---|---|
| `conditional-jump` | string | string | [How UniChef works](../../learn/how-unichef-works.md) |
<!-- /docs:head -->

## How it works

Conditional Jump goes to the [Label](label.md) named `to` when `pattern` matches the dish (as
text), or when it does not match, with `invert`. It does this at most `max` times; then it
continues with a `W_JUMP_LIMIT` warning.

**Worked example.** Peel layers of Base64 until something else appears:

```json
{"version": 1, "steps": [
  {"op": "label", "args": {"name": "start"}},
  {"op": "from-base64"},
  {"op": "conditional-jump", "args": {"pattern": "^[A-Za-z0-9+/]+=*$", "to": "start"}}
]}
```

`V20xNGFGb3pkRFJtVVQwOQ==` decodes to `Vm14aFozdDRmUT09`, which still matches, so the recipe
jumps back; then to `bGFnZ3t4fQ==`… until `flag{x}`, which does not match, and the recipe ends.

Obfuscated payloads often wrap the same encoding many times; a loop like this unwraps any
number of layers. The pattern uses the portable regex profile.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `pattern` | regex | — | — |
| `flags` | string | — | — |
| `invert` | boolean | `false` | — |
| `to` | string | — | — |
| `max` | integer 0 to 1000 | `10` | — |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKzs9LySwBSibm6GaV5hYo6SglFqUDFVTX1sbWAgA), or search for "Conditional jump" in the operation list.

**CLI:**

```sh
unichef op conditional-jump
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("conditional-jump", {}, Dish.of_string(""))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("conditional-jump", {}, { type: 'string', value: "" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Control flow on Wikipedia](https://en.wikipedia.org/wiki/Control_flow)
- Related: [Label](label.md), [Jump](jump.md), [From Base64](from-base64.md), [How UniChef works](../../learn/how-unichef-works.md)

<!-- docs:nav -->
---

[← Comment](comment.md) · [Contents](../../README.md) · [Fork →](fork.md)
<!-- /docs:nav -->
