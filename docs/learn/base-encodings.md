<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Base encodings

Many channels carry only text: email, JSON, URLs, HTML, a terminal, a QR code. A **base
encoding** writes arbitrary bytes using a small alphabet of safe characters, so binary data
such as a key, an image or a ciphertext can travel through them. It is not encryption: anyone
can decode it, and it hides nothing.

All of them work the same way: read the bytes as one big number (or as groups of bits), and
write that number in a base equal to the size of the alphabet.

| Encoding | Alphabet size | Bits per character | Output size | Typical use |
|---|---|---|---|---|
| Binary | 2 | 1 | 8× | teaching, bit flags |
| Octal | 8 | 3 | 3 digits per byte | Unix permissions, C escapes |
| Decimal | 10 | about 3.3 | up to 3 digits per byte | byte lists, CTF puzzles |
| Hex (Base16) | 16 | 4 | 2× | hashes, keys, packet dumps |
| Base32 | 32 | 5 | 1.6× | TOTP secrets, case-insensitive IDs |
| Base58 | 58 | about 5.86 | about 1.37× | Bitcoin addresses, IPFS IDs |
| Base64 | 64 | 6 | 1.33× | email, data URLs, JWTs, PEM |
| Base85 | 85 | about 6.41 | 1.25× | PDF, PostScript, Git binary patches |

## Hex

Each byte is two hex digits, one per 4-bit half (nibble): the byte 233 is `1110 1001`, which
is `e` and `9`, so `e9`. Hex is the lingua franca of security work because it maps byte for
byte and nibble for nibble: you can read bit patterns and lengths straight off it. See
[To Hex](../reference/ops/to-hex.md) and [From Hex](../reference/ops/from-hex.md). Binary,
octal and decimal are the same idea in base 2, 8 and 10, one number per byte.

## Base64

Base64 takes the input **three bytes (24 bits) at a time** and splits them into **four 6-bit
groups**. Each group, 0 to 63, picks a character from
`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`.

**Worked example: `Hi!`**

```
bytes     H        i        !
hex       48       69       21
bits      01001000 01101001 00100001
6-bit     010010 000110 100100 100001
values    18     6      36     33
chars     S      G      k      h
```

So `Hi!` is `SGkh`. When the input is not a multiple of three bytes, the last group is
padded with zero bits and the output with `=`: one leftover byte gives two characters and
`==`, two leftover bytes give three characters and `=`. `Hi` is `SGk=`.

Variants differ only in the alphabet and padding. **base64url** (RFC 4648 §5) uses `-` and
`_` instead of `+` and `/`, so it is safe in URLs and file names, and usually drops the
padding: JWTs use it. [To Base64](../reference/ops/to-base64.md) supports both and custom
alphabets, which malware sometimes uses to hide strings.

## Base32

Base32 takes **five bytes (40 bits)** at a time and writes **eight 5-bit groups** from
`A–Z` and `2–7`, padding with `=` to a multiple of eight characters. It has no lower case
and no `0`, `1`, `8` or `9`, so `0` and `1` cannot be confused with `O` and `I`, so people can read
it aloud and type it: authenticator apps use it for TOTP secrets. base32hex (§7) uses
`0–9A–V` and keeps sort order. See [To Base32](../reference/ops/to-base32.md).

## Base58

Base58 treats the whole input as **one big-endian number** and repeatedly divides by 58.
Its alphabet leaves out `0`, `O`, `I` and `l` (which look alike) and `+` and `/`, so a value
can be double-clicked and copied as one word. Because there is no bit alignment, every
**leading zero byte** is written as the first alphabet character (`1` in the Bitcoin
alphabet) to keep it. It is slow on long inputs (quadratic), so it is used for short
identifiers. See [To Base58](../reference/ops/to-base58.md).

## Base85

Ascii85 takes **four bytes** as a 32-bit number and writes it as **five base-85 digits**,
each added to 33 (`!`). Four zero bytes become a single `z`. Adobe wraps it in `<~` and
`~>`. **Z85** (ZeroMQ) uses a different alphabet that avoids quotes and backslashes, so it
can sit in source code strings. See [To Base85](../reference/ops/to-base85.md).

## Recognising an encoding

| You see | Probably |
|---|---|
| `0–9a–f`, even length | hex |
| `A–Za–z0–9+/`, length a multiple of 4, may end in `=` or `==` | Base64 |
| `A–Za–z0–9-_`, three dot-separated parts starting `eyJ` | a JWT (base64url JSON) |
| `A–Z2–7`, ends in `=` padding to a multiple of 8 | Base32 |
| no `0OIl`, starts with `1` or `3`, 26 to 35 characters | Base58 (a Bitcoin address) |
| starts with `<~` | Ascii85 |

`eyJ` is how `{"` looks in Base64, so it marks Base64-encoded JSON.

## Security notes

Base encodings are reversible by anyone. Finding `cGFzc3dvcmQ=` in a config file means the
password is `password`, not that it is protected. Decoders also differ in what they accept:
whitespace, missing padding, characters outside the alphabet. By default UniChef's decoders
skip characters outside the alphabet so you can paste messy data; turn on `strict` to reject
them, which is what you want when you check that two systems agree.

<!-- docs:ops -->
Operations explained here: [From Base32](../reference/ops/from-base32.md), [From Base58](../reference/ops/from-base58.md), [From Base64](../reference/ops/from-base64.md), [From Base85](../reference/ops/from-base85.md), [From Binary](../reference/ops/from-binary.md), [From Decimal](../reference/ops/from-decimal.md), [From Hex](../reference/ops/from-hex.md), [From Octal](../reference/ops/from-octal.md), [To Base32](../reference/ops/to-base32.md), [To Base58](../reference/ops/to-base58.md), [To Base64](../reference/ops/to-base64.md), [To Base85](../reference/ops/to-base85.md), [To Binary](../reference/ops/to-binary.md), [To Decimal](../reference/ops/to-decimal.md), [To Hex](../reference/ops/to-hex.md), [To Octal](../reference/ops/to-octal.md).
<!-- /docs:ops -->

## Learn more

- [RFC 4648: Base16, Base32 and Base64](https://www.rfc-editor.org/rfc/rfc4648)
- [Base58 in the Bitcoin wiki](https://en.bitcoin.it/wiki/Base58Check_encoding)
- [Z85 specification (ZeroMQ RFC 32)](https://rfc.zeromq.org/spec/32/)
- [Ascii85 on Wikipedia](https://en.wikipedia.org/wiki/Ascii85)

<!-- docs:nav -->
---

[← Unicode](unicode.md) · [Contents](../README.md) · [Web encodings →](web-encodings.md)
<!-- /docs:nav -->
