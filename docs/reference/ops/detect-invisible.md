<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Security

# Detect Invisible Characters

One row per invisible code point: bidi controls (Trojan Source, CVE-2021-42574), tag characters, variation selectors, zero-width characters, Hangul fillers and other default-ignorables. `index` is the 0-based code-point offset; `line` and `column` are 1-based, lines are LF-separated and columns count code points.

| Id | Input | Output | Background |
|---|---|---|---|
| `detect-invisible` | string | table | [Unicode security](../../learn/unicode-security.md) |
<!-- /docs:head -->

## How it works

Detect Invisible lists every code point that does not show up on screen but changes the text.

| `kind` | Examples | Why it matters |
|---|---|---|
| `bidi-control` | U+202E RIGHT-TO-LEFT OVERRIDE, U+2066–2069 isolates | Trojan Source: code reads differently from how it runs |
| `zero-width` | U+200B ZERO WIDTH SPACE, U+200C/U+200D joiners, U+FEFF | split keywords past filters, make two equal-looking names differ |
| `tag` | U+E0000–E007F | hide an ASCII message, a known prompt-injection trick |
| `variation-selector` | U+FE00–FE0F, U+E0100–E01EF | change glyphs, carry hidden data |
| `hangul-filler` | U+3164 HANGUL FILLER, U+115F, U+1160 | blank-looking names and messages |
| `default-ignorable` | U+00AD SOFT HYPHEN, U+2060 WORD JOINER | other characters that render as nothing |

**Worked example.** `pass`, ZERO WIDTH SPACE, `word`, SOFT HYPHEN, `!`:

| index | cp | name | kind | line | column |
|---|---|---|---|---|---|
| 4 | U+200B | ZERO WIDTH SPACE | zero-width | 1 | 5 |
| 9 | U+00AD | SOFT HYPHEN | default-ignorable | 1 | 10 |

`index` counts code points from 0. `line` and `column` count from 1, with lines split at LF,
so you can jump to the spot in an editor. The list comes from the UCD's
Default_Ignorable_Code_Point and Bidi_Control properties, so it stays up to date with each
Unicode version.

## Security notes

Run it on anything pasted from an untrusted source before it reaches code, a user name, a
domain or a language model prompt. The `unichef scan` command does the same for files and can
fail a CI job.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `a\u200bb\u2060c` | — | `index\tcp\tname\tkind\tline\tcolumn\n1\tU+200B\tZERO WIDTH SPACE\tzero-width\t1\t2\n3\tU+2060\tWORD JOINER\tzero-width\t1\t4` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKSS1JTS7RzcwryyzOTMpJVdJRSixKByqorq2NrQUA&i=S3zU0J30qHFBMgA), or search for "Detect Invisible Characters" in the operation list.

**CLI:**

```sh
unichef op detect-invisible $'a\u200bb\u2060c'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("detect-invisible", {}, Dish.of_string("a\u200bb\u2060c"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("detect-invisible", {}, { type: 'string', value: "a\u200bb\u2060c" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Trojan Source (CVE-2021-42574)](https://trojansource.codes/)
- [UTS #39 §3.1: default-ignorable characters](https://www.unicode.org/reports/tr39/)
- [Invisible characters and prompt injection with tag characters](https://embracethered.com/blog/posts/2024/hiding-and-finding-text-with-unicode-tags/)
- Related: [Remove Bidi Controls](remove-bidi-controls.md), [Escape Unicode](escape-unicode.md), [Unicode security](../../learn/unicode-security.md)

<!-- docs:nav -->
---

[← Detect Confusables](detect-confusables.md) · [Contents](../../README.md) · [Remove Bidi Controls →](remove-bidi-controls.md)
<!-- /docs:nav -->
