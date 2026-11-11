<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Flow

# Comment

An annotation. The dish passes through unchanged, whatever its type.

| Id | Input | Output | Background |
|---|---|---|---|
| `comment` | bytes | bytes | [How UniChef works](../../learn/how-unichef-works.md) |
<!-- /docs:head -->

## How it works

Comment does nothing to the data: the dish passes through unchanged, whatever its type. It
holds a `text` note for whoever reads the recipe.

**Worked example.**

```json
{"version": 1, "steps": [
  {"op": "comment", "args": {"text": "Stage 2: the payload is Base64 of gzip"}},
  {"op": "from-base64"},
  {"op": "gunzip"}
]}
```

Comments make shared recipes, gallery entries and incident notes easier to follow. They are
kept in share links and exports.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `text` | string | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `unchanged` | `text=notes for readers` | `unchanged` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DcwxCoAwDEbhq5R_7uKaq4hDqVEc2pQkiFB6d7O-D97Ey2qPdNCWYc7DQPuEDBCqtMbdkVH0jj7h_HlAF2dLl2hSLmcMsNaxfg&i=K81LzkjMS09NAQA), or search for "Comment" in the operation list.

**CLI:**

```sh
unichef op comment --arg 'text=notes for readers' unchanged
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("comment", {"text": "notes for readers"}, Dish.of_string("unchanged"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("comment", {"text": "notes for readers"}, { type: 'string', value: "unchanged" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [CyberChef's Comment operation, the model for this one](https://github.com/gchq/CyberChef/wiki)
- Related: [Label](label.md), [Sub-recipe](sub-recipe.md), [How UniChef works](../../learn/how-unichef-works.md)

<!-- docs:nav -->
---

[← Unique lines](unique-lines.md) · [Contents](../../README.md) · [Conditional jump →](conditional-jump.md)
<!-- /docs:nav -->
