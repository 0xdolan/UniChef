<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Classical ciphers and XOR

Classical ciphers replace or shift letters by a simple rule. None of them is secure today: a
computer breaks every one in milliseconds. You still meet them constantly in CTF challenges,
puzzles, malware that hides its strings, and old software. Knowing how they work tells you
how to recognise and undo them.

## Shift ciphers: Caesar and ROT13

A **Caesar cipher** shifts every letter by a fixed amount, wrapping from Z to A. With a
shift of 3, `Hello` becomes `Khoor`. In numbers, with A = 0:

```
encrypt: c = (p + k) mod 26
decrypt: p = (c − k) mod 26
```

**ROT13** is the shift of 13. Because 13 + 13 = 26, applying it twice gives the original, so
one operation both encodes and decodes. Forums used it to hide spoilers. With the `amount`
argument, [ROT13](../reference/ops/rot13.md) is any Caesar shift.

**ROT47** applies the same idea to the 94 printable ASCII characters from `!` (0x21) to `~`
(0x7E), shifting by 47, so digits and punctuation change too: `Hello, World!` becomes
`w6==@[ (@C=5P`. See [ROT47](../reference/ops/rot47.md).

**Breaking it.** There are only 25 possible shifts: try them all and read the one that makes
sense.

## Atbash

[Atbash](../reference/ops/atbash.md) mirrors the alphabet: A↔Z, B↔Y, C↔X. `Hello` becomes
`Svool`. Like ROT13 it is its own inverse, and it has no key at all. It comes from Hebrew,
where it swapped the first and last letters of the alphabet.

## Vigenère

The **Vigenère cipher** uses a keyword to choose a different shift for each letter. With the
key `KEY` (K = 10, E = 4, Y = 24):

```
plaintext   H  e  l  l  o  ,  W  o  r  l  d  !
key         K  E  Y  K  E     Y  K  E  Y  K
shift       10 4  24 10 4     24 10 4  24 10
ciphertext  R  i  j  v  s  ,  U  y  v  j  n  !
```

Characters that are not letters pass through and do not use up a key letter. For three
centuries it was called "le chiffre indéchiffrable". It is broken by finding the key length
(the **Kasiski examination** looks for repeated fragments, and the **index of coincidence**
measures how much the letter frequencies look like a language), then solving each position as
a Caesar cipher by frequency analysis. See [Vigenère Encode](../reference/ops/vigenere-encode.md)
and [Vigenère Decode](../reference/ops/vigenere-decode.md).

## XOR

**Exclusive or** compares two bits and gives 1 when they differ:

| a | b | a ⊕ b |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 0 |

XOR-ing twice with the same key gives the original back, because `(p ⊕ k) ⊕ k = p`. That
makes XOR the core of every stream cipher and of AES's CTR mode, and also the favourite
"encryption" of malware authors who want to hide strings from antivirus scanners.

[XOR](../reference/ops/xor.md) repeats the key across the input. With the key `KEY`
(`4b 45 59`), `secret` (`73 65 63 72 65 74`) becomes `38 20 3a 39 20 2d`. A neat example: in
ASCII, upper- and lower-case letters differ only in bit 5 (`0x20`), so XOR with `20` swaps the
case of letters.

**Breaking repeating-key XOR.**

1. **XOR with a known part.** If you know some of the plaintext, such as a file header (`MZ`
   for Windows executables, `%PDF`, `PK` for Zip, `{"`), XOR it with the ciphertext and the key
   appears.
2. **Single-byte keys.** There are only 256 of them: try each and score the output by how much
   it looks like text. Key `00` leaves the data unchanged, and zero bytes in the plaintext
   reveal the key directly.
3. **Longer keys.** Guess the key length with the Hamming distance between blocks, then solve
   each key byte as a single-byte XOR. Cryptopals set 1 walks through it.

A **one-time pad** (a truly random key as long as the message, used once) is the one form of
XOR that is unbreakable. Reuse the key once and it falls apart.

<!-- docs:ops -->
Operations explained here: [Atbash](../reference/ops/atbash.md), [ROT13](../reference/ops/rot13.md), [ROT47](../reference/ops/rot47.md), [Vigenère Decode](../reference/ops/vigenere-decode.md), [Vigenère Encode](../reference/ops/vigenere-encode.md), [XOR](../reference/ops/xor.md).
<!-- /docs:ops -->

## Learn more

- [Caesar cipher on Wikipedia](https://en.wikipedia.org/wiki/Caesar_cipher)
- [Vigenère cipher on Wikipedia](https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher)
- [Cryptopals set 1: basics, including repeating-key XOR](https://cryptopals.com/sets/1)
- [Practical Cryptography: classical ciphers](http://practicalcryptography.com/ciphers/)

<!-- docs:nav -->
---

[← Encryption](encryption.md) · [Contents](../README.md) · [Compression →](compression.md)
<!-- /docs:nav -->
