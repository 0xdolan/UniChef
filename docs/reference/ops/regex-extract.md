<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Regex extract

List every match of `pattern` (or its capture group `group`), joined by `separator`. Empty matches count; a group that did not participate gives "".

| Id | Input | Output | Background |
|---|---|---|---|
| `regex-extract` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Regex Extract lists every match of `pattern`, or of its capture group `group`, joined by
`separator` (a new line by default). It uses the portable regex profile, with Unicode always
on, so `\p{Script=Cyrillic}` and `\p{L}` work.

**Worked examples.**
- IPv4 addresses: pattern `\b\d{1,3}(?:\.\d{1,3}){3}\b` on `from 10.0.0.1 to 192.168.1.20 ok`
  gives `10.0.0.1` and `192.168.1.20`, one per line.
- Values only: pattern `(\w+)=(\w+)`, `group=2`, `separator=,` on `a=1 b=2 c=3` gives `1,2,3`.
- Hidden Cyrillic: pattern `\p{Script=Cyrillic}+` on `pаypal вход` gives `а` and `вход`.

Empty matches are listed too (as empty strings), and a group that did not take part in a match
gives an empty string, so the number of results always equals the number of matches. The
[Regex lab](../../learn/data-and-text.md) in the web app highlights each match and explains
the pattern.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `pattern` | regex | — | — |
| `flags` | string | — | — |
| `group` | integer 0 to 99 | `0` | — |
| `separator` | string | `\n` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Mail ana@example.org or bo@example.net` | `pattern=[\w.]+@[\w.]+`, `separator=
` | `ana@example.org\nbo@example.net` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=LYuxDoAgDAX_5a2iiSuT_wEMjWmMC5C2URLCv8vgdMPddTwsepcMvzuocVX40FEqPIQvbis3EzoNDiTXtB2VzFjmghDju6Xl-Dkb5UpCVmTamDFGGh8&i=803MzFFIzEt0SK1IzC3ISdXLL0pXyC9SSMqHi-SllgAA), or search for "Regex extract" in the operation list.

**CLI:**

```sh
unichef op regex-extract --arg 'pattern=[\w.]+@[\w.]+' --arg 'separator=
' 'Mail ana@example.org or bo@example.net'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("regex-extract", {"pattern": "[\\w.]+@[\\w.]+", "separator": "\n"}, Dish.of_string("Mail ana@example.org or bo@example.net"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("regex-extract", {"pattern": "[\\w.]+@[\\w.]+", "separator": "\n"}, { type: 'string', value: "Mail ana@example.org or bo@example.net" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Regular-Expressions.info](https://www.regular-expressions.info/)
- [UTS #18: Unicode regular expressions](https://www.unicode.org/reports/tr18/)
- Related: [Find / Replace](find-replace.md), [Subsection](subsection.md), [Unique Lines](unique-lines.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Join lines](join.md) · [Contents](../../README.md) · [Reverse →](reverse.md)
<!-- /docs:nav -->
