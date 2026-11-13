<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Decode Text

Decode bytes from a character encoding. Ill-formed input becomes U+FFFD.

| Id | Input | Output | Background |
|---|---|---|---|
| `decode-text` | bytes | string | [Text and bytes](../../learn/text-and-bytes.md) |
<!-- /docs:head -->

## How it works

Decode Text reads bytes as characters in the encoding you choose, the reverse of
[Encode Text](encode-text.md).

- **UTF-8** decodes one to four bytes per character according to the lead byte (see
  [UTF-8 Explain](utf8-explain.md)).
- **UTF-16** reads 16-bit units in the chosen byte order and combines surrogate pairs.
- **UTF-32** reads 32-bit units.
- **ISO-8859-1** maps each byte to the code point of the same value.
- **Windows-1252** does the same except for 80–9F, where it has `€ ‚ ƒ „ … † ‡ ˆ ‰ Š ‹ Œ Ž ‘ ’ “ ” • – — ˜ ™ š › œ ž Ÿ`.
- **ASCII** accepts only bytes below 0x80.

Bytes that are not valid in the encoding (a truncated UTF-8 sequence, an unpaired surrogate,
an odd byte count in UTF-16) become U+FFFD `�` with `errors=replace`, or fail with
`errors=strict`. A byte order mark at the start is kept as U+FEFF, so you can see it.

**Worked example: repairing mojibake.** The text `cafÃ©` is UTF-8 that was decoded as
Windows-1252. Encode it back with [Encode Text](encode-text.md) set to `windows-1252` (giving
`63 61 66 c3 a9`), then decode those bytes here with `utf-8`: `café`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `encoding` | choice | `utf-8` | `utf-8`, `utf-16le`, `utf-16be`, `utf-32le`, `utf-32be`, `iso-8859-1`, `windows-1252`, `ascii` |
| `errors` | choice | `replace` | `replace`, `strict` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `café` | — | `café` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKSU3OT0nVLUmtKFHSUUosSgfKVdfWxtYCAA&i=S05MO7wSAA), or search for "Decode Text" in the operation list.

**CLI:**

```sh
unichef op decode-text 'café'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("decode-text", {}, Dish.of_string("café"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("decode-text", {}, { type: 'string', value: "café" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)
- [Mojibake on Wikipedia](https://en.wikipedia.org/wiki/Mojibake)
- Related: [Encode Text](encode-text.md), [From Hex](from-hex.md), [Text and bytes](../../learn/text-and-bytes.md)

<!-- docs:nav -->
---

[← Decode NetBIOS Name](decode-netbios-name.md) · [Contents](../../README.md) · [Encode NetBIOS Name →](encode-netbios-name.md)
<!-- /docs:nav -->
