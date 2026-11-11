<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Find / replace

Replace matches of `pattern` with `replacement`. As a regex, the replacement uses JavaScript syntax: `$$`, `$&`, `$1`-`$99` and `$<name>`; empty matches are replaced too. With `literal`, both are plain text and the pattern must not be empty.

| Id | Input | Output | Background |
|---|---|---|---|
| `find-replace` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Find / Replace replaces matches of `pattern` with `replacement`.

As a **regex** (the default), the pattern uses UniChef's portable regex profile, which gives
the same results in Python and in the browser. Flags are `i` (ignore case), `m` (`^` and `$`
match at line breaks), `s` (`.` matches line breaks) and `x` (ignore whitespace in the
pattern). The replacement uses JavaScript syntax:

| In `replacement` | Inserts |
|---|---|
| `$&` | the whole match |
| `$1` to `$99` | a numbered capture group |
| `$<name>` | a named group |
| `$$` | a literal `$` |

**Worked examples.**
- Pattern `(\w+)@(\w+)\.com`, replacement `$2 at $1`: `ada@example.com, bob@test.com` becomes
  `example at ada, test at bob`.
- With `literal`, the pattern and replacement are plain text: `.` replaced by `!` turns `a.b.c`
  into `a!b!c`.
- With `global` off, only the first match is replaced: pattern `a`, flags `i`, replacement `X`
  turns `AaA` into `XaA`.

Empty matches are replaced too, as in JavaScript: pattern `x*` with replacement `-` turns `ab`
into `-a-b-`. A pattern that takes too long stops at the regex timeout.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `pattern` | regex | — | — |
| `flags` | string | — | — |
| `replacement` | string | — | — |
| `literal` | boolean | `false` | — |
| `global` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `2026-11-07` | `pattern=(\d+)-(\d+)-(\d+)`, `replacement=$3/$2/$1` | `07/11/2026` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=VYuxCoAgGAbf5cOhSAlr81WyQfIvglJRaRHfPYeWphvuruChmE7voCRHyhQS1FLgAxT201kRKVxmI3CYeDRZEEzOFNuBTms79OKHFn7LTS63iM0jm0YmUetaXw&i=MzIwMtM1NNQ1MAcA), or search for "Find / replace" in the operation list.

**CLI:**

```sh
unichef op find-replace --arg 'pattern=(\d+)-(\d+)-(\d+)' --arg 'replacement=$3/$2/$1' 2026-11-07
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("find-replace", {"pattern": "(\\d+)-(\\d+)-(\\d+)", "replacement": "$3/$2/$1"}, Dish.of_string("2026-11-07"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("find-replace", {"pattern": "(\\d+)-(\\d+)-(\\d+)", "replacement": "$3/$2/$1"}, { type: 'string', value: "2026-11-07" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [MDN: String.prototype.replace and replacement patterns](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_the_replacement)
- [Regular-Expressions.info](https://www.regular-expressions.info/)
- Related: [Regex Extract](regex-extract.md), [Subsection](subsection.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Parse URL](parse-url.md) · [Contents](../../README.md) · [Head →](head.md)
<!-- /docs:nav -->
