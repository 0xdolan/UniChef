<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Flow

# Label

A jump target. The dish passes through unchanged, whatever its type.

| Id | Input | Output | Background |
|---|---|---|---|
| `label` | bytes | bytes | [How UniChef works](../../learn/how-unichef-works.md) |
<!-- /docs:head -->

## How it works

Label marks a place in the recipe that [Jump](jump.md) and
[Conditional Jump](conditional-jump.md) can go back (or forward) to. The dish passes through
unchanged.

**Worked example.** Decode Base64 until the result is no longer Base64:

```json
{"version": 1, "steps": [
  {"op": "label", "args": {"name": "start"}},
  {"op": "from-base64"},
  {"op": "conditional-jump", "args": {"pattern": "^[A-Za-z0-9+/]+=*$", "to": "start"}}
]}
```

`V20xNGFGb3pkRFJtVVQwOQ==` (`flag{x}` encoded three times) gives `flag{x}`.

A label name must be unique within its list of steps.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `name` | string | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `unchanged` | `name=start` | `unchanged` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKSUxKzVHSUUosSgeKVivlJeamAoWLSxKLSpRqa2NrAQ&i=K81LzkjMS09NAQA), or search for "Label" in the operation list.

**CLI:**

```sh
unichef op label --arg name=start unchanged
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("label", {"name": "start"}, Dish.of_string("unchanged"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("label", {"name": "start"}, { type: 'string', value: "unchanged" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Control flow on Wikipedia](https://en.wikipedia.org/wiki/Control_flow)
- Related: [Jump](jump.md), [Conditional Jump](conditional-jump.md), [How UniChef works](../../learn/how-unichef-works.md)

<!-- docs:nav -->
---

[← Jump](jump.md) · [Contents](../../README.md) · [Sub-recipe →](sub-recipe.md)
<!-- /docs:nav -->
