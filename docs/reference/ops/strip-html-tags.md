<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Strip HTML tags

Remove everything from `<` to the next `>`, repeating until none is left. Then `remove_indentation` drops spaces and tabs after each line feed, and `remove_line_breaks` drops a blank first line and folds runs of blank lines into one line feed. The result is text, not safe HTML.

| Id | Input | Output | Background |
|---|---|---|---|
| `strip-html-tags` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`strip-html-tags` removes every run of text from `<` to the next `>`. It repeats until nothing
changes, so a split tag such as `<<b>script>` cannot rebuild itself.

**Worked example**

```
<div>
    <p>one</p>


    <p>two</p>
</div>
```

1. Removing the tags leaves a line feed, `    one`, three line feeds, `    two` and a line feed.
2. `remove_indentation` removes the spaces after each line feed.
3. `remove_line_breaks` removes the blank first line and folds runs of blank lines into one.

Result: `one`, `two` on two lines, with a final line feed.

The operation works on text and does not parse HTML: it does not decode entities such as
`&amp;`, and `a < b and c > d` becomes `a  d`. The output is not safe to insert into a page as
HTML.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `remove_indentation` | boolean | `true` | — |
| `remove_line_breaks` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `<p>Hello <b>world</b></p>` | — | `Hello world` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QsgJyizILdDNKcnN0SxLTi5V0lBKLgJRVdW1tbC0A&i=symw80jNyclXsEmyK88vykmx0U-ys9EvsAMA), or search for "Strip HTML tags" in the operation list.

**CLI:**

```sh
unichef op strip-html-tags '<p>Hello <b>world</b></p>'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("strip-html-tags", {}, Dish.of_string("<p>Hello <b>world</b></p>"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("strip-html-tags", {}, { type: 'string', value: "<p>Hello <b>world</b></p>" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [OWASP: cross-site scripting prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- Related: [HTML entity decode](html-entity-decode.md), [Remove ANSI escape codes](remove-ansi-escape-codes.md)

<!-- docs:nav -->
---

[← Split](split.md) · [Contents](../../README.md) · [Swap case →](swap-case.md)
<!-- /docs:nav -->
