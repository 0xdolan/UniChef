<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Flow

# Jump

Jump to the label `to`, at most `max` times; then continue with a W_JUMP_LIMIT warning. Every jump counts towards the step limit.

| Id | Input | Output | Background |
|---|---|---|---|
| `jump` | string | string | [How UniChef works](../../learn/how-unichef-works.md) |
<!-- /docs:head -->

## How it works

Jump continues the recipe at the [Label](label.md) named `to`, at most `max` times. After
that it does nothing, with a `W_JUMP_LIMIT` warning, and the recipe continues with the next
step.

**Worked example.** Base64-encode three times:

```json
{"version": 1, "steps": [
  {"op": "label", "args": {"name": "again"}},
  {"op": "to-base64"},
  {"op": "jump", "args": {"to": "again", "max": 2}}
]}
```

`hi` gives `aGk=`, then `YUdrPQ==`, then `WVVkclBRPT0=`: the first pass plus two jumps.

Every step run after a jump counts towards the recipe's step limit, so a loop can never run
forever. For a loop that stops on its own, use [Conditional Jump](conditional-jump.md).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `to` | string | — | — |
| `max` | integer 0 to 1000 | `10` | — |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKKs0tUNJRSixKBwpW19bG1gIA), or search for "Jump" in the operation list.

**CLI:**

```sh
unichef op jump
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("jump", {}, Dish.of_string(""))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("jump", {}, { type: 'string', value: "" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Control flow on Wikipedia](https://en.wikipedia.org/wiki/Control_flow)
- Related: [Label](label.md), [Conditional Jump](conditional-jump.md), [How UniChef works](../../learn/how-unichef-works.md)

<!-- docs:nav -->
---

[← Fork](fork.md) · [Contents](../../README.md) · [Label →](label.md)
<!-- /docs:nav -->
