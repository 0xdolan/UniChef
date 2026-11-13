<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Hexdump

Write `width` bytes per line: the offset, the bytes in hex and the bytes as Latin-1 text, with controls and the soft hyphen as dots (`ascii_only` keeps only printable ASCII). `final_length` adds a last line with the total length.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-hexdump` | bytes | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

Each line shows `width` bytes three ways: the offset of the first byte as eight hex digits,
the bytes as two hex digits each, and the bytes as text between `|` bars. The hex column is
padded so the text column always lines up.

The text column reads each byte as Latin-1 (one byte, one character). Controls (below 0x20 and
0x7F–0x9F) and the soft hyphen 0xAD show as `.`; with `ascii_only`, everything outside
printable ASCII does.

**Worked example: `Hi € ok`, a line feed and `!`, with `width=8`**

```
00000000  48 69 20 e2 82 ac 20 6f  |Hi â.¬ o|
00000008  6b 0a 21                 |k.!|
```

`€` is three UTF-8 bytes, `e2 82 ac`, which the text column shows as `â`, `.` and `¬`. With
`final_length`, a last line `0000000b` gives the total, 11 bytes.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `width` | integer 1 to 65536 | `16` | — |
| `upper` | boolean | `false` | — |
| `final_length` | boolean | `false` | — |
| `ascii_only` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi!` | — | `00000000  48 69 21                                         \|Hi!\|` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNSK1IKc0tUNJRSixKB0pV19bG1gIA&i=88hUBAA), or search for "To Hexdump" in the operation list.

**CLI:**

```sh
unichef op to-hexdump 'Hi!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-hexdump", {}, Dish.of_string("Hi!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-hexdump", {}, { type: 'string', value: "Hi!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [hexdump(1) manual page](https://man7.org/linux/man-pages/man1/hexdump.1.html)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [From Hexdump](from-hexdump.md), [To Hex](to-hex.md)

<!-- docs:nav -->
---

[← To Hex Content](to-hex-content.md) · [Contents](../../README.md) · [To Modhex →](to-modhex.md)
<!-- /docs:nav -->
