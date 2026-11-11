<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Unicode

Unicode is the standard that numbers every character in every writing system: more than
150 000 characters in over 160 scripts, plus symbols and emoji. UniChef uses its own copy of
the **Unicode Character Database** (UCD) for every Unicode operation, pinned to one Unicode
version, so results are the same in every browser and Python version.

## Code points, characters and graphemes

A **code point** is a number from U+0000 to U+10FFFF. Most are assigned to characters, some
are reserved, and U+D800–U+DFFF (surrogates) are kept for UTF-16 and never stand for a
character. What a reader sees as one character is often several code points. Unicode calls
that a **grapheme cluster** (UAX #29):

| Visible | Code points | Count |
|---|---|---|
| `é` | U+0065 LATIN SMALL LETTER E, U+0301 COMBINING ACUTE ACCENT | 2 |
| `👋🏽` | U+1F44B WAVING HAND SIGN, U+1F3FD EMOJI MODIFIER FITZPATRICK TYPE-4 | 2 |
| `🇮🇶` | U+1F1EE, U+1F1F6 (regional indicators I and Q) | 2 |
| `👨‍👩‍👧` | man, ZWJ, woman, ZWJ, girl | 5 |

So "length" has several answers. For `é👋🏽` written with a precomposed `é`,
[Count](../reference/ops/count.md) gives 10 bytes in UTF-8, 5 UTF-16 units (what JavaScript's
`length` reports), 3 code points and 2 graphemes. Cutting text by code points can split an
emoji or separate a letter from its accent; [Head](../reference/ops/head.md),
[Tail](../reference/ops/tail.md) and [Reverse](../reference/ops/reverse.md) can work in
graphemes to avoid that.

## Character properties

The UCD gives each code point dozens of properties. The ones UniChef shows in
[Analyse Characters](../reference/ops/analyse-characters.md):

- **Name**, such as `LATIN SMALL LETTER E WITH ACUTE`. Names never change once assigned.
- **General_Category** (`gc`): `Lu` upper-case letter, `Ll` lower-case letter, `Mn` nonspacing
  mark, `Nd` decimal digit, `Zs` space separator, `Cf` format character, `Cc` control, and so
  on. The first letter is the group: L letters, M marks, N numbers, P punctuation, S symbols,
  Z separators, C other.
- **Script** and **Script_Extensions**: Latin, Cyrillic, Arabic, Han... Digits and
  punctuation are `Common`, and combining marks shared by scripts are `Inherited`.
- **Block**: the named range a code point sits in, such as `Basic Latin` or `Cyrillic`.
  A block is only an address range: Script is the property to use for "what alphabet is
  this".
- **Age**: the Unicode version that added the character.
- **Bidi_Class**: how the character behaves in bidirectional text (see below).
- **East_Asian_Width**, **decomposition**, and flags such as default-ignorable or deprecated.

[Filter by Property](../reference/ops/filter-by-property.md) keeps or removes characters by
General_Category, Script, Script_Extensions or Block.

## Normalisation

Some text has more than one encoding in code points. `é` can be U+00E9 (precomposed) or
U+0065 U+0301 (decomposed). They look the same but compare, hash and sort differently.
[Normalize](../reference/ops/normalize.md) applies one of the four forms of UAX #15:

| Form | What it does | `é` becomes | `ﬁ` becomes |
|---|---|---|---|
| NFC | canonical composition | U+00E9 | `ﬁ` |
| NFD | canonical decomposition | U+0065 U+0301 | `ﬁ` |
| NFKC | compatibility, then composition | U+00E9 | `fi` |
| NFKD | compatibility decomposition | U+0065 U+0301 | `fi` |

Canonical forms (NFC, NFD) keep the meaning exactly. Compatibility forms (NFKC, NFKD) also
fold look-alike variants such as ligatures, circled digits, full-width letters and
superscripts, which is useful for search and identifiers but loses formatting. Normalise
before you compare or hash user text. [Strip Diacritics](../reference/ops/strip-diacritics.md)
is built on NFD.

## Case

Case mapping is not one character to one character. `ß` upper-cases to `SS`; Greek capital
sigma lower-cases to `ς` at the end of a word and `σ` elsewhere (Final_Sigma); Turkish and
Azerbaijani map `I` to dotless `ı` and `İ` to `i`. **Case folding** is the form for
case-insensitive comparison. [Unicode Case](../reference/ops/unicode-case.md) implements full
mapping with these rules.

## Bidirectional text

Arabic, Hebrew and some other scripts are written right to left. The **Unicode
Bidirectional Algorithm** (UAX #9) decides the display order from each character's
Bidi_Class: `L` left-to-right letters, `R` and `AL` right-to-left letters, `EN` and `AN`
numbers, neutrals that take the direction of their neighbours, and explicit controls such as
RIGHT-TO-LEFT OVERRIDE (U+202E) that force a direction. Those controls let the order on
screen differ from the order in memory, which is what Trojan Source attacks exploit: see
[Unicode security](unicode-security.md). [Show Bidi Classes](../reference/ops/show-bidi-classes.md)
lists the class of every character.

## Escapes

Source code and data formats write characters they cannot hold directly as escapes: `\u00E9`
in JavaScript and JSON, `\U0001F44B` in Python and C, `U+00E9` in prose, `&#xE9;` in HTML,
`%u00E9` in old JavaScript `escape()`. [Escape Unicode](../reference/ops/escape-unicode.md)
and [Unescape Unicode](../reference/ops/unescape-unicode.md) convert between them. Formats
built on UTF-16, such as `\u`, write characters above U+FFFF as a surrogate pair:
`\uD83D\uDC4B` for `👋`.

<!-- docs:ops -->
Operations explained here: [Analyse Characters](../reference/ops/analyse-characters.md), [Count](../reference/ops/count.md), [Escape Unicode](../reference/ops/escape-unicode.md), [Filter by Property](../reference/ops/filter-by-property.md), [Grapheme Split](../reference/ops/grapheme-split.md), [Normalize](../reference/ops/normalize.md), [Show Bidi Classes](../reference/ops/show-bidi-classes.md), [Strip Diacritics](../reference/ops/strip-diacritics.md), [Unescape Unicode](../reference/ops/unescape-unicode.md), [Unicode Case](../reference/ops/unicode-case.md).
<!-- /docs:ops -->

## Learn more

- [The Unicode Standard](https://www.unicode.org/versions/latest/)
- [UAX #44: the Unicode Character Database](https://www.unicode.org/reports/tr44/)
- [UAX #29: text segmentation (graphemes)](https://www.unicode.org/reports/tr29/)
- [UAX #15: normalization forms](https://www.unicode.org/reports/tr15/)
- [UAX #9: the bidirectional algorithm](https://www.unicode.org/reports/tr9/)
- [UniView](https://r12a.github.io/uniview/), a character browser by Richard Ishida

<!-- docs:nav -->
---

[← Text and bytes](text-and-bytes.md) · [Contents](../README.md) · [Base encodings →](base-encodings.md)
<!-- /docs:nav -->
