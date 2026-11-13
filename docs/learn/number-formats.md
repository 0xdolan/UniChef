<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Number and key formats: floats, BCD, text as a number, Bech32 and PEM

The same bytes can be a fraction, a row of decimal digits, one very large number or a key.
Nothing in the bytes says which; the format is an agreement between the writer and the reader.
This guide covers the formats you meet when reading binary files, old hardware data and
cryptographic material.

## Floating-point numbers

Almost every program stores fractions as IEEE 754 numbers. A number is written like scientific
notation in base 2, in three fields:

| Size | Sign | Exponent | Fraction | Decimal digits it keeps |
|---|---|---|---|---|
| `float` (4 bytes) | 1 bit | 8 bits | 23 bits | about 7 |
| `double` (8 bytes) | 1 bit | 11 bits | 52 bits | about 16 |

The value is `(1 + fraction) × 2^exponent`, after a fixed bias is taken off the stored
exponent. [To Float](../reference/ops/to-float.md) reads bytes as numbers and
[From Float](../reference/ops/from-float.md) writes them. The bytes `41 42 43 44`, the text
`ABCD`, are the float `12.141422271728516`.

Three things surprise people:

- **Most decimal fractions are not exact.** 0.1 has no finite form in base 2, just as 1/3 has
  none in base 10. The nearest float is `0.10000000149011612`.
- **Byte order matters.** Intel and ARM machines store the least significant byte first
  (`little`); network formats and many file formats store the most significant first (`big`).
  Read with the wrong order and you get nonsense, not an error.
- **There are special values.** `Infinity`, `-Infinity`, `NaN` (not a number, the result of
  0/0) and a zero with a minus sign all have their own bit patterns.

## Binary-coded decimal

Binary-coded decimal (BCD) avoids the rounding problem by keeping decimal digits: each digit
gets four bits. `1234` is `0001 0010 0011 0100`. It wastes space, since four bits could count
to 15, but every decimal value is exact and easy to show on a display. Clock chips, payment
messages and mainframe files still use it.

[To BCD](../reference/ops/to-bcd.md) and [From BCD](../reference/ops/from-bcd.md) handle the
common variants:

- **Schemes.** `8421` is plain binary per digit. `excess-3` adds 3 to each digit, and `2421`
  and `84-2-1` weight the bits differently; all three make the nine's complement of a digit a
  simple bit flip, which old adders relied on.
- **Packed or not.** Packed BCD puts two digits in a byte. Unpacked (zoned) BCD puts one
  digit in a byte.
- **Sign.** A final nibble of `1100` means plus and `1101` minus.

## Text as one big number

A text is bytes, and bytes are digits in base 256, so any text is also one integer: `ABC` is
`0x414243`, which is 4276803. [Text-Integer Conversion](../reference/ops/text-integer.md)
moves between the text, the decimal form and the hex form. Textbook RSA works on numbers, so
this is the step between a message and the number that is raised to a power; you will see it
in every RSA exercise and capture-the-flag task.

## Bech32

Bech32 is a Base32 variant made for values that people copy by hand, first of all Bitcoin
addresses. A string such as `bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4` has:

1. a **human-readable part** (`bc`) that says what the value is for,
2. the separator `1`,
3. the **data**, in an alphabet without the look-alike characters `1`, `b`, `i` and `o`,
4. a six-character **checksum** that catches any four wrong characters.

A string is all lower case or all upper case, never mixed. Bech32m is the same format with a
different checksum constant; it fixed a weakness where adding or removing a `q` before a final
`p` kept the checksum valid. Bitcoin uses Bech32 for version 0 addresses and Bech32m for
version 1 (Taproot) and later. Other projects use the format too, with their own
human-readable parts: Lightning invoices (`lnbc`), Nostr keys (`npub`) and age keys (`age`).

[To Bech32](../reference/ops/to-bech32.md) encodes bytes and
[From Bech32](../reference/ops/from-bech32.md) checks a string and gives the bytes back. A
checksum does not prove that an address belongs to anyone; it only catches typing mistakes.

## PEM

Keys and certificates are binary structures (DER). PEM wraps them in text so they survive
email and copy and paste:

```
-----BEGIN CERTIFICATE-----
MIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5
…
-----END CERTIFICATE-----
```

The body is plain Base64 in lines of 64 characters, and the label says what is inside.
[PEM to Hex](../reference/ops/pem-to-hex.md) unwraps every block in the input to hex, and
[Hex to PEM](../reference/ops/hex-to-pem.md) wraps hex bytes again. PEM is a wrapper, not
encryption: anyone can read the contents of a `PRIVATE KEY` block unless the key inside is
itself encrypted.

<!-- docs:ops -->
Operations explained here: [From BCD](../reference/ops/from-bcd.md), [From Bech32](../reference/ops/from-bech32.md), [From Float](../reference/ops/from-float.md), [Hex to PEM](../reference/ops/hex-to-pem.md), [PEM to Hex](../reference/ops/pem-to-hex.md), [Text-Integer Conversion](../reference/ops/text-integer.md), [To BCD](../reference/ops/to-bcd.md), [To Bech32](../reference/ops/to-bech32.md), [To Float](../reference/ops/to-float.md).
<!-- /docs:ops -->

## Learn more

- [IEEE 754 on Wikipedia](https://en.wikipedia.org/wiki/IEEE_754)
- [Float Toy](https://evanw.github.io/float-toy/)
- [Binary-coded decimal on Wikipedia](https://en.wikipedia.org/wiki/Binary-coded_decimal)
- [BIP-173: Bech32](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki) and [BIP-350: Bech32m](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki)
- [RFC 7468: Textual Encodings of PKIX, PKCS, and CMS Structures](https://www.rfc-editor.org/rfc/rfc7468)

<!-- docs:nav -->
---

[← Text formats: hexdumps, escapes and identifier cases](text-formats.md) · [Contents](../README.md) · [Operation reference →](../reference/README.md)
<!-- /docs:nav -->
