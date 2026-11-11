<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Text and bytes

Computers store bytes: numbers from 0 to 255. Text is an idea: a sequence of characters. A
**character encoding** is the rule that turns one into the other. Almost every confusing
result in data analysis ("why does my hash differ?", "why is there `Ã©` instead of `é`?")
comes from text and bytes being converted with different rules.

## Characters, code points and bytes

Unicode gives every character a number, its **code point**, written `U+` and at least four hex
digits: `A` is U+0041, `é` is U+00E9, `€` is U+20AC and `😀` is U+1F600. Code points run from
U+0000 to U+10FFFF. A code point is still not a byte: an encoding decides how to store it.

| Character | Code point | UTF-8 | UTF-16LE | Latin-1 |
|---|---|---|---|---|
| `A` | U+0041 | `41` | `41 00` | `41` |
| `é` | U+00E9 | `c3 a9` | `e9 00` | `e9` |
| `€` | U+20AC | `e2 82 ac` | `ac 20` | not representable |
| `😀` | U+1F600 | `f0 9f 98 80` | `3d d8 00 de` | not representable |

## UTF-8

UTF-8 is the encoding of the web, of JSON and of almost every modern file. It uses one to
four bytes per code point:

| Code points | Bytes | Bit pattern |
|---|---|---|
| U+0000 to U+007F | 1 | `0xxxxxxx` |
| U+0080 to U+07FF | 2 | `110xxxxx 10xxxxxx` |
| U+0800 to U+FFFF | 3 | `1110xxxx 10xxxxxx 10xxxxxx` |
| U+10000 to U+10FFFF | 4 | `11110xxx 10xxxxxx 10xxxxxx 10xxxxxx` |

**Worked example.** `é` is U+00E9, binary `000 1110 1001` (11 bits). It needs the two-byte
form. The first five bits `00011` go into `110xxxxx`, giving `11000011` = `c3`. The last six
bits `101001` go into `10xxxxxx`, giving `10101001` = `a9`. So `é` is `c3 a9`.
[UTF-8 Explain](../reference/ops/utf8-explain.md) shows this split for every byte of your
input.

ASCII text is unchanged in UTF-8, and a byte below `0x80` never appears inside a multi-byte
character. That is why UTF-8 is safe for file paths and protocols designed for ASCII.

Not every byte sequence is valid UTF-8. A lone continuation byte (`a9`), a truncated
sequence (`c3` at the end), an over-long form (`c0 af` for `/`) or an encoded surrogate are
all **ill-formed**. UniChef replaces each ill-formed part with U+FFFD `�`, as the WHATWG
Encoding Standard does. Overlong forms matter in security: old decoders that accepted
`c0 af` as `/` let attackers slip `../` past path filters.

## UTF-16 and UTF-32

UTF-16 stores code points up to U+FFFF in two bytes. Larger ones are split into a
**surrogate pair**: two 16-bit units from the ranges D800–DBFF and DC00–DFFF. `😀` U+1F600
becomes `D83D DE00`. JavaScript strings, Java, Windows and .NET use UTF-16 internally, which
is why `"😀".length` is 2 in JavaScript. UTF-32 stores every code point in four bytes.

Both come in little-endian (LE) and big-endian (BE) byte orders. A **byte order mark**
(U+FEFF) at the start of a file can say which one is used. UniChef never adds a BOM when
encoding, and keeps one as U+FEFF when decoding, so you can see it.

## Single-byte encodings

ISO-8859-1 (Latin-1) maps each byte 00–FF to U+0000–U+00FF. Windows-1252 is the same except
that 80–9F hold printable characters such as `€` (80) and curly quotes (91–94). ASCII covers
only 00–7F. These encodings cannot represent most of Unicode: with `errors=replace` a missing
character becomes `?`, and with `errors=strict` the step fails.

## Mojibake

Decoding bytes with the wrong encoding gives **mojibake**. The UTF-8 bytes `c3 a9` of `é`,
read as Windows-1252, become `Ã©`. To repair it, reverse the mistake: encode the text back
with the wrong encoding, then decode it with the right one. In UniChef:
[Encode Text](../reference/ops/encode-text.md) with `windows-1252`, then
[Decode Text](../reference/ops/decode-text.md) with `utf-8`.

## Why it matters for hashes and ciphers

Hashes, HMACs and ciphers work on bytes. `café` in UTF-8 (`63 61 66 c3 a9`) and in Latin-1
(`63 61 66 e9`) have different MD5 digests. Two spellings of the same visible text, such as
`é` as one code point and as `e` plus a combining accent, also differ: see
[Normalize](../reference/ops/normalize.md). When a digest does not match, compare the bytes
with [To Hex](../reference/ops/to-hex.md) first.

<!-- docs:ops -->
Operations explained here: [Decode Text](../reference/ops/decode-text.md), [Encode Text](../reference/ops/encode-text.md), [From Code Points](../reference/ops/from-code-points.md), [To Code Points](../reference/ops/to-code-points.md), [UTF-8 Explain](../reference/ops/utf8-explain.md).
<!-- /docs:ops -->

## Learn more

- [RFC 3629: UTF-8](https://www.rfc-editor.org/rfc/rfc3629)
- [RFC 2781: UTF-16](https://www.rfc-editor.org/rfc/rfc2781)
- [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)
- [The Unicode Standard, chapter 3: conformance](https://www.unicode.org/versions/latest/core-spec/chapter-3/)
- [Joel Spolsky: The absolute minimum every software developer must know about Unicode](https://www.joelonsoftware.com/2003/10/08/the-absolute-minimum-every-software-developer-absolutely-positively-must-know-about-unicode-and-character-sets-no-excuses/)

<!-- docs:nav -->
---

[← How UniChef works](how-unichef-works.md) · [Contents](../README.md) · [Unicode →](unicode.md)
<!-- /docs:nav -->
