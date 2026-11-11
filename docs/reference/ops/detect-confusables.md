<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Security

# Detect Confusables

UTS #39 skeletons (NFD, confusables.txt, NFD). With a `reference`, one row compares both skeletons (code points as hex) and `confusable` is `true` when they are equal. Without one, one row per code point that has a confusables.txt prototype.

| Id | Input | Output | Background |
|---|---|---|---|
| `detect-confusables` | string | table | [Unicode security](../../learn/unicode-security.md) |
<!-- /docs:head -->

## How it works

Two strings are *confusable* when they look alike but use different characters, such as
`paypal` and `pаypal` with a Cyrillic `а`. UTS #39 decides this with a **skeleton**:

1. Convert to NFD.
2. Replace every character with its prototype from `confusables.txt`: Cyrillic `а` becomes
   Latin `a`, `m` becomes `rn`, `0` becomes `O`.
3. Convert to NFD again.

Two strings are confusable when their skeletons are equal.

**Worked example 1: with `reference=paypal.com`.** The input `pаypal.com` has a Cyrillic `а`.
Both skeletons are `p a y p a l . c o r n`, so `confusable` is `true`. Note that `m` became
`rn` in both: a skeleton is for comparison only, not for display.

**Worked example 2: without a reference.** One row per character that has a prototype:

| index | cp | name | prototype |
|---|---|---|---|
| 1 | U+0430 | CYRILLIC SMALL LETTER A | U+0061 |
| 9 | U+006D | LATIN SMALL LETTER M | U+0072 U+006E |

Plain Latin letters such as `m` appear too, because `rn` looks like `m`.

## Security notes

Use it to check new domain names, user names and package names against a list of protected
ones (your brand, popular packages). Combine with [Script Mix Check](script-mix-check.md): a
confusable that is also mixed-script is almost always an attack.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `reference` | string | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `pаypal` | — | `index\tcp\tname\tprototype\n1\tU+0430\tCYRILLIC SMALL LETTER A\tU+0061` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKSS1JTS7RTc7PSystTkzKSS1W0lFKLEoHKqmurY2tBQA&i=K7iwobIgMQcA), or search for "Detect Confusables" in the operation list.

**CLI:**

```sh
unichef op detect-confusables 'pаypal'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("detect-confusables", {}, Dish.of_string("pаypal"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("detect-confusables", {}, { type: 'string', value: "pаypal" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UTS #39 §4: confusable detection](https://www.unicode.org/reports/tr39/#Confusable_Detection)
- [confusables.txt](https://www.unicode.org/Public/security/latest/confusables.txt)
- [IDN homograph attack on Wikipedia](https://en.wikipedia.org/wiki/IDN_homograph_attack)
- Related: [Script Mix Check](script-mix-check.md), [IDNA to Unicode](idna-to-unicode.md), [Unicode security](../../learn/unicode-security.md)

<!-- docs:nav -->
---

[← UTF-8 Explain](utf8-explain.md) · [Contents](../../README.md) · [Detect Invisible Characters →](detect-invisible.md)
<!-- /docs:nav -->
