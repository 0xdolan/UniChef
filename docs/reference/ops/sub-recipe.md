<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Flow

# Sub-recipe

Run `steps` as one group. The runner keeps the dish type across the group; this function serves direct calls only.

| Id | Input | Output | Background |
|---|---|---|---|
| `sub-recipe` | bytes | bytes | [How UniChef works](../../learn/how-unichef-works.md) |
<!-- /docs:head -->

## How it works

Sub-recipe runs its `steps` as one group, so that a sequence of steps can be named, collapsed,
disabled or reused as one unit in the web app.

**Worked example.** A recipe that decodes a common payload format:

```json
{"version": 1, "steps": [
  {"op": "sub-recipe", "args": {"steps": [{"op": "from-base64"}, {"op": "gunzip"}]}},
  {"op": "to-hex"}
]}
```

`H4sIAAAAAAAA/8tIzcnJBwCGphA2BQAAAA==` gives `68 65 6c 6c 6f` (`hello`).

The dish keeps its type across the group, as if the steps were written inline. Groups can be
nested up to the recipe depth limit (8).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `steps` | steps | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `hello` | `steps=[{"op": "to-base64"}, {"op": "reverse"}]` | `=8GbsVGa` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLk3SLUpNzixIVdJRSixKB0pVo6spyddNSixONTNRqtWBChWlgsxMVaqNrQUiAA&i=y0jNyckHAA), or search for "Sub-recipe" in the operation list.

**CLI:**

```sh
unichef op sub-recipe --arg 'steps=[{"op": "to-base64"}, {"op": "reverse"}]' hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("sub-recipe", {"steps": [{"op": "to-base64"}, {"op": "reverse"}]}, Dish.of_string("hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("sub-recipe", {"steps": [{"op": "to-base64"}, {"op": "reverse"}]}, { type: 'string', value: "hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Subroutine on Wikipedia](https://en.wikipedia.org/wiki/Function_(computer_programming))
- Related: [Fork](fork.md), [Subsection](subsection.md), [Comment](comment.md), [How UniChef works](../../learn/how-unichef-works.md)

<!-- docs:nav -->
---

[← Label](label.md) · [Contents](../../README.md) · [Subsection →](subsection.md)
<!-- /docs:nav -->
