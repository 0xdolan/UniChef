<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Flow

# Fork

Split the input on `split`, run `steps` on each part, and join the results with `merge`. An error in any branch fails the fork; its path names the branch.

| Id | Input | Output | Background |
|---|---|---|---|
| `fork` | string | string | [How UniChef works](../../learn/how-unichef-works.md) |
<!-- /docs:head -->

## How it works

Fork splits the input on `split`, runs its `steps` on each part separately, and joins the
results with `merge`.

**Worked example.** Decode a list of Base64 values, one per line:

```json
{"version": 1, "steps": [
  {"op": "fork", "args": {"split": "\n", "merge": ", ", "steps": [{"op": "from-base64"}]}}
]}
```

`aGk=` and `Ynll` on two lines give `hi, bye`. Without the fork, [From Base64](from-base64.md)
would decode the two values as one, giving the wrong bytes after the first.

An error in any part fails the whole fork, and the error path names the part, so you can find
the bad line. Forks can be nested, up to the recipe depth limit.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `split` | string | `\n` | — |
| `merge` | string | `\n` | — |
| `steps` | steps | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `a,b,c` | `split=,`, `merge= \| `, `steps=[{"op": "unicode-case", "args": {"mode": "upper"}}]` | `A \| B \| C` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=ZYsxCoAwEAS_IlvHwjZfEQuJpwSNOe6iTfTvnp0gu8Uyy1ScJBrzDt85aCFW-L4iMzzmLCscRlkMVihvsRh2lkSykO3mavDzjj2GPFEbRqWPn4y9LzMJ7nt4-wA&i=S9RJ0kkGAA), or search for "Fork" in the operation list.

**CLI:**

```sh
unichef op fork --arg split=, --arg 'merge= | ' --arg 'steps=[{"op": "unicode-case", "args": {"mode": "upper"}}]' a,b,c
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("fork", {"split": ",", "merge": " | ", "steps": [{"op": "unicode-case", "args": {"mode": "upper"}}]}, Dish.of_string("a,b,c"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("fork", {"split": ",", "merge": " | ", "steps": [{"op": "unicode-case", "args": {"mode": "upper"}}]}, { type: 'string', value: "a,b,c" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [CyberChef's Fork and Merge, the model for this one](https://github.com/gchq/CyberChef/wiki/Recipe-loading)
- Related: [Subsection](subsection.md), [Split](split.md), [Sub-recipe](sub-recipe.md), [How UniChef works](../../learn/how-unichef-works.md)

<!-- docs:nav -->
---

[← Conditional jump](conditional-jump.md) · [Contents](../../README.md) · [Jump →](jump.md)
<!-- /docs:nav -->
