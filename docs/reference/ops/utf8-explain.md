<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# UTF-8 Explain

One row per byte: its bits, its role in the UTF-8 structure and, on the first byte of each sequence, the code point it encodes. Ill-formed input decodes to U+FFFD by maximal subparts, as everywhere else, and `note` says why.

| Id | Input | Output | Background |
|---|---|---|---|
| `utf8-explain` | bytes | table | [Text and bytes](../../learn/text-and-bytes.md) |
<!-- /docs:head -->

## How it works

UTF-8 Explain shows how UTF-8 stores each character, byte by byte. In UTF-8 a code point
takes one to four bytes. The top bits of each byte say its role:

| Bits | Role | Payload bits | Code points |
|---|---|---|---|
| `0xxxxxxx` | single byte (ASCII) | 7 | U+0000–U+007F |
| `110xxxxx` | lead of 2 | 5 | U+0080–U+07FF |
| `1110xxxx` | lead of 3 | 4 | U+0800–U+FFFF |
| `11110xxx` | lead of 4 | 3 | U+10000–U+10FFFF |
| `10xxxxxx` | continuation | 6 | — |

The code point is the payload bits joined in order.

**Worked example: `é👋`**

| Offset | Byte | Bits | Role | Code point |
|---|---|---|---|---|
| 0 | `C3` | `110 00011` | lead of 2 | U+00E9 `é` |
| 1 | `A9` | `10 101001` | continuation | |
| 2 | `F0` | `11110 000` | lead of 4 | U+1F44B `👋` |
| 3 | `9F` | `10 011111` | continuation | |
| 4 | `91` | `10 010001` | continuation | |
| 5 | `8B` | `10 001011` | continuation | |

For `é`: payload `00011` and `101001` join into `00011101001` = 0xE9.

Ill-formed input is labelled in the `note` column and decodes to U+FFFD, one replacement per
*maximal subpart* as the Unicode Standard and WHATWG require. Overlong forms (such as `C0 AF`
for `/`), surrogates encoded as UTF-8 (`ED A0 80`) and values above 10FFFF are all ill-formed.

## Security notes

Overlong encodings used to bypass path filters: a decoder that accepted `C0 AF` as `/` let
`..%C0%AF` through a check for `../`. A strict decoder rejects them, and this view shows them.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `é€` | — | `offset\tbyte\tbits\trole\tcp\tchar\tnote\n0\tC3\t11000011\tlead of 2\tU+00E9\té\t\n1\tA9\t10101001\tcontinuation\t\t\t\n2\tE2\t11100010\tlead of 3\tU+20AC\t€\t\n3\t82\t10000010\tcontinuation\t\t\t\n4\tAC\t10101100\tcontinuation\t\t\t` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLUmz0E2tKMhJzMxT0lFKLEoHSlbX1sbWAgA&i=O7zyUdMaAA), or search for "UTF-8 Explain" in the operation list.

**CLI:**

```sh
unichef op utf8-explain 'é€'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("utf8-explain", {}, Dish.of_string("é€"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("utf8-explain", {}, { type: 'string', value: "é€" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 3629: UTF-8](https://www.rfc-editor.org/rfc/rfc3629)
- [Unicode Standard §3.9: U+FFFD substitution of maximal subparts](https://www.unicode.org/versions/latest/core-spec/chapter-3/)
- Related: [To Hex](to-hex.md), [Decode Text](decode-text.md), [Text and bytes](../../learn/text-and-bytes.md)

<!-- docs:nav -->
---

[← Unicode Case](unicode-case.md) · [Contents](../../README.md) · [Detect Confusables →](detect-confusables.md)
<!-- /docs:nav -->
