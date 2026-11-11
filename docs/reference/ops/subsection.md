<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Flow

# Subsection

Run `steps` on each match of `pattern` (or on its capture group `group`) and splice the results back; the rest of the dish passes through. Empty matches and groups that did not participate are left alone. With `global` off, only the first match is used. An error inside a match fails the step; its path names the match.

| Id | Input | Output | Background |
|---|---|---|---|
| `subsection` | string | string | [How UniChef works](../../learn/how-unichef-works.md) |
<!-- /docs:head -->

## How it works

Subsection runs its `steps` only on the parts of the text that match `pattern` (or on capture
group `group`), and puts the results back in place. The rest of the text is unchanged.

**Worked example.** Decode only the values in a log line:

```json
{"version": 1, "steps": [
  {"op": "subsection", "args": {"pattern": "=(\\S+)", "group": 1, "steps": [{"op": "from-base64"}]}}
]}
```

`id=aGk= name=Ynll` gives `id=hi name=bye`.

With `global` off, only the first match is processed. Empty matches, and groups that did not
take part in a match, are left alone. An error inside a match fails the step, and the error
path names the match.

Subsection is the tool for mixed content: decode the Base64 strings inside a script, the
percent-encoded parts of a URL, or the hex blobs inside a log, while keeping the context.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `pattern` | regex | — | — |
| `flags` | string | — | — |
| `group` | integer 0 to 99 | `0` | — |
| `global` | boolean | `true` | — |
| `steps` | steps | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `name=zoë id=7` | `pattern==(\w+)`, `group=1`, `steps=[{"op": "unicode-case", "args": {"mode": "upper"}}]` | `name=ZOË id=7` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=bcyxCoAwEAPQf8mkqINrwS9Rh1oPcdAed60OxX-33RyETHkhCReJ7v6E6VtoIFaYMcEzDDQuSi4UbWFly5TANgSSvMdQTdPd1Nk28ZH_HuK5O79S56zS5-PIXVFmEjzPXPIC&i=y0vMTbWtyj-8WiEzxdYcAA), or search for "Subsection" in the operation list.

**CLI:**

```sh
unichef op subsection --arg 'pattern==(\w+)' --arg group=1 --arg 'steps=[{"op": "unicode-case", "args": {"mode": "upper"}}]' 'name=zoë id=7'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("subsection", {"pattern": "=(\\w+)", "group": 1, "steps": [{"op": "unicode-case", "args": {"mode": "upper"}}]}, Dish.of_string("name=zoë id=7"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("subsection", {"pattern": "=(\\w+)", "group": 1, "steps": [{"op": "unicode-case", "args": {"mode": "upper"}}]}, { type: 'string', value: "name=zoë id=7" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Regular-Expressions.info: capture groups](https://www.regular-expressions.info/brackets.html)
- Related: [Fork](fork.md), [Regex Extract](regex-extract.md), [Find / Replace](find-replace.md), [How UniChef works](../../learn/how-unichef-works.md)

<!-- docs:nav -->
---

[← Sub-recipe](sub-recipe.md) · [Contents](../../README.md)
<!-- /docs:nav -->
