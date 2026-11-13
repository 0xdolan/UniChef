<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Letter codes: Morse, Braille, NATO and leet

These codes write letters in another form so that they can be sent by sound, touch or radio,
or just to look different. None of them hides anything: each is a fixed table anyone can look
up. You meet them in puzzles, CTF challenges and ham radio, and recognising the shape of the
output is most of the work.

## Morse code

International Morse code writes each character as a sequence of short and long signals, dots
and dashes. Common letters are short (`E` is `.`, `T` is `-`) and rare ones long (`Q` is
`--.-`). [To Morse code](../reference/ops/to-morse-code.md) puts `letter_delimiter` (a space by
default) between letters and `word_delimiter` (a line feed by default) between words:

```
SOS         ... --- ...
Hi all      .... ..
            .- .-.. .-..
```

Morse has codes for letters, digits and some punctuation only. A character without a code,
such as `é`, writes nothing, but its delimiters stay, so the gap shows where it was.

[From Morse code](../reference/ops/from-morse-code.md) reads dashes written as `-`, `_`, `–`,
`—` or the word `dash`, and dots written as `.`, `·` or `dot`, so `DashDotDot Dot` decodes as
`DE`. The output is upper case, because Morse has no case. Make sure the delimiters match the
input: with the wrong word delimiter, a whole sentence reads as one long word.

## NATO phonetic alphabet

The NATO spelling alphabet gives each letter a word that is hard to mishear over a bad radio
line: Alfa, Bravo, Charlie… [To NATO alphabet](../reference/ops/to-nato-alphabet.md) replaces
each ASCII letter, digit, `,`, `/` and `.` with its word and a space, so `Hi 5` becomes
`Hotel India  Five ` (the space in the input stays, giving two). Alfa and Juliett are spelled
that way on purpose, so speakers of other languages pronounce them correctly.

## Braille

Braille cells have six dots in two columns, which gives 64 patterns. Unicode has them all at
U+2800–U+283F, numbered by which dots are raised. **North American Braille ASCII** assigns one
ASCII character to each pattern, so that Braille files can be stored as plain text.
[To Braille](../reference/ops/to-braille.md) uses that table: `Hi!` becomes `⠓⠊⠮`.
[From Braille](../reference/ops/from-braille.md) reverses it, giving upper-case letters.

This is a one-to-one character table, not real reading Braille (Grade 1 or 2), which uses
contractions and prefix cells for capitals and numbers. Eight-dot patterns (U+2840 and up)
have no Braille ASCII character and are left as they are.

## Leet speak

Leet (from "elite") swaps letters for digits that look like them. [Leet speak](../reference/ops/leet-speak.md)
uses the six most common swaps: `a`→`4`, `e`→`3`, `i`→`1`, `o`→`0`, `s`→`5` and `t`→`7`.
`Leet speak` becomes `L337 5p34k`. The `from` direction swaps the digits back to lower-case
letters, which cannot know the original case and also changes any real digits in the text.

<!-- docs:ops -->
Operations explained here: [From Braille](../reference/ops/from-braille.md), [From Morse code](../reference/ops/from-morse-code.md), [To Braille](../reference/ops/to-braille.md), [To Morse code](../reference/ops/to-morse-code.md), [To NATO alphabet](../reference/ops/to-nato-alphabet.md), [Leet speak](../reference/ops/leet-speak.md).
<!-- /docs:ops -->

## Learn more

- [Morse code on Wikipedia](https://en.wikipedia.org/wiki/Morse_code)
- [ITU-R M.1677-1, International Morse code](https://www.itu.int/rec/R-REC-M.1677-1-200910-I/)
- [NATO phonetic alphabet on Wikipedia](https://en.wikipedia.org/wiki/NATO_phonetic_alphabet)
- [Braille ASCII on Wikipedia](https://en.wikipedia.org/wiki/Braille_ASCII)
- [Unicode Braille Patterns chart (PDF)](https://www.unicode.org/charts/PDF/U2800.pdf)

<!-- docs:nav -->
---

[← Classical ciphers and XOR](classical-ciphers.md) · [Contents](../README.md) · [Compression →](compression.md)
<!-- /docs:nav -->
