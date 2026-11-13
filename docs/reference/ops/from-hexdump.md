<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Hexdump

Read the bytes back from a hexdump in the xxd, hexdump -C, Wireshark or 010 Editor style: on each line, an optional offset and then the hex columns. Check the result.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-hexdump` | string | bytes | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

Each line is read as an optional offset (4 to 16 hex digits, optionally followed by `h` or
`:`), then the hex columns. The text column at the end is ignored, because it does not look
like groups of hex digits separated by single spaces. This covers the layouts of `xxd`,
`hexdump -C`, `od`-style four-digit groups, Wireshark and the 010 Editor.

**Worked example**

`00000000  48 69 20 e2 82 ac 20 6f  |Hi â.¬ o|` gives the eight bytes `48 69 20 e2 82 ac 20 6f`,
which is `Hi € o` as UTF-8.

A text column made only of hex-looking pairs can be read as data, so check the length of the
result.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `00000000  48 69 21                                         \|Hi!\|` | — | `Hi!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1c1IrUgpzS1Q0lFKLEoHSlbX1sbWAgA&i=MzCAAAUFEwsFM0sFI0MFYkGNR6ZiDQA), or search for "From Hexdump" in the operation list.

**CLI:**

```sh
unichef op from-hexdump '00000000  48 69 21                                         |Hi!|'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-hexdump", {}, Dish.of_string("00000000  48 69 21                                         |Hi!|"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-hexdump", {}, { type: 'string', value: "00000000  48 69 21                                         |Hi!|" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [xxd(1) manual page](https://man7.org/linux/man-pages/man1/xxd.1.html)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [To Hexdump](to-hexdump.md), [From Hex](from-hex.md)

<!-- docs:nav -->
---

[← From Hex Content](from-hex-content.md) · [Contents](../../README.md) · [From Modhex →](from-modhex.md)
<!-- /docs:nav -->
