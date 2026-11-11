<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Unicode security

Unicode lets text look like something it is not. Two strings can look identical on screen
and differ in memory, and code can run in a different order from the one a reviewer reads.
These tricks are behind phishing domains, spoofed user names, poisoned AI prompts and the
Trojan Source attack on source code. UniChef's security operations make them visible.

## Invisible characters

Many code points draw nothing at all:

| Kind | Examples | Abused for |
|---|---|---|
| zero-width | U+200B ZERO WIDTH SPACE, U+200C/U+200D (non-)joiners, U+2060 WORD JOINER, U+FEFF | splitting keywords to dodge filters, fingerprinting leaked text, duplicate-looking user names |
| bidi controls | U+202A–U+202E embeddings and overrides, U+2066–U+2069 isolates, U+200E/U+200F marks | Trojan Source, misleading file names (`photo` + RLO + `gpj.exe` shows as `photoexe.jpg`) |
| tag characters | U+E0000–U+E007F | hiding instructions inside text given to AI models ("ASCII smuggling") |
| variation selectors | U+FE00–U+FE0F, U+E0100–U+E01EF | hiding data in emoji, changing how a character looks |
| fillers | U+3164 HANGUL FILLER, U+115F | names that look empty, invisible identifiers in code |

[Detect Invisible](../reference/ops/detect-invisible.md) lists each one with its line and
column. [Remove Bidi Controls](../reference/ops/remove-bidi-controls.md) deletes the bidi
controls. [Escape Unicode](../reference/ops/escape-unicode.md) with scope `non-printable` shows
them in place as `\u200B`.

## Trojan Source

The Unicode Bidirectional Algorithm reorders text for display (see [Unicode](unicode.md)).
Explicit controls such as RIGHT-TO-LEFT OVERRIDE (U+202E) and the isolates (U+2066–U+2069)
can be placed **inside comments and string literals**, where compilers ignore them but
editors obey them. The code a reviewer sees is then in a different order from the code the
compiler reads. The 2021 paper "Trojan Source" (CVE-2021-42574) showed this in C, C++, Go,
JavaScript, Python, Rust and Java: for example, an early `return` that looks like part of a
comment, or an access check whose condition looks commented out.

Defences:
- run `unichef scan --fail-on bidi` in CI, so a pull request with bidi controls in code fails;
- look at suspicious lines with [Show Bidi Classes](../reference/ops/show-bidi-classes.md),
  which lists every character in memory order with its direction class.

## Confusables and homoglyphs

Many characters look alike across scripts: Latin `a` (U+0061) and Cyrillic `а` (U+0430),
Latin `o`, Greek `ο` and Cyrillic `о`, the digit `0` and the letter `O`, `l`, `I` and `1`.
`pаypal.com` with a Cyrillic `а` is a different domain from `paypal.com`. Unicode Technical
Standard #39 lists such pairs in `confusables.txt` and defines a **skeleton**:

1. Normalise the string to NFD.
2. Replace every character by its prototype from `confusables.txt` (Cyrillic `а` → Latin `a`).
3. Normalise to NFD again.

Two strings are **confusable** when their skeletons are equal.
[Detect Confusables](../reference/ops/detect-confusables.md) shows which characters have a
look-alike, or compares the input with a reference: `pаypal` against `paypal` gives the
skeleton `0070 0061 0079 0070 0061 006C` for both, so `confusable` is `true`.

## Mixed scripts

Real words rarely mix scripts, so mixing is a strong signal of spoofing. UTS #39 defines
**restriction levels** for a string, which
[Script Mix Check](../reference/ops/script-mix-check.md) reports:

| Level | Meaning | Example |
|---|---|---|
| ASCII-Only | only ASCII | `paypal` |
| Single Script | one script (plus Common and Inherited characters) | `παράδειγμα` |
| Highly Restrictive | Latin plus Han with Hiragana and Katakana, or Han with Bopomofo, or Han with Hangul | `東京tokyo` |
| Moderately Restrictive | Latin plus one other script, except Cyrillic and Greek | `abcא` |
| Minimally Restrictive | any other mix, including Latin with Cyrillic or Greek | `pаypal` |
| Unrestricted | characters not allowed in identifiers at all | `pay pal!` |

Browsers use rules like these to decide whether to show an internationalised domain as
Unicode or as `xn--` Punycode. Identifiers such as user names should usually be at least
Highly Restrictive.

## A recipe for checking a suspicious domain

1. [IDNA to Unicode](../reference/ops/idna-to-unicode.md) on `xn--pypal-4ve.com` shows
   `pаypal.com`.
2. [Script Mix Check](../reference/ops/script-mix-check.md) reports Minimally Restrictive.
3. [Detect Confusables](../reference/ops/detect-confusables.md) with the reference `paypal.com`
   reports a match.
4. [Analyse Characters](../reference/ops/analyse-characters.md) names the culprit: U+0430
   CYRILLIC SMALL LETTER A.

<!-- docs:ops -->
Operations explained here: [Detect Confusables](../reference/ops/detect-confusables.md), [Detect Invisible Characters](../reference/ops/detect-invisible.md), [Remove Bidi Controls](../reference/ops/remove-bidi-controls.md), [Script Mix Check](../reference/ops/script-mix-check.md).
<!-- /docs:ops -->

## Learn more

- [UTS #39: Unicode security mechanisms](https://www.unicode.org/reports/tr39/)
- [UTR #36: Unicode security considerations](https://www.unicode.org/reports/tr36/)
- [Trojan Source: Invisible Vulnerabilities](https://trojansource.codes/)
- [CVE-2021-42574](https://nvd.nist.gov/vuln/detail/CVE-2021-42574)
- [Chromium's IDN display policy](https://chromium.googlesource.com/chromium/src/+/main/docs/idn.md)
- [Unicode confusables data](https://www.unicode.org/Public/security/latest/confusables.txt)

<!-- docs:nav -->
---

[← Compression](compression.md) · [Contents](../README.md) · [Data formats and text processing →](data-and-text.md)
<!-- /docs:nav -->
