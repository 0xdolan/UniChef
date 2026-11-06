# UniChef specification

The files in this folder are the single source of truth that both cores (Python and TypeScript) implement and test against (PRD §3).

| File | Purpose |
|---|---|
| `recipe.schema.json` | Recipe v1 format (PRD §3.4). |
| `output.schema.json` | CLI `--json` output envelope (PRD §5.6). |
| `errors.json` | Error codes with exit codes, and warning codes (PRD §3.7). Validated by `errors.schema.json`. |
| `vector.schema.json` | Format of the shared test vectors (PRD §3.9). |
| `vectors/<category>/<op>.json` | Per-operation test vectors. |
| `vectors/_recipes/*.json` | Whole-recipe test vectors. |

Validate everything with:

```sh
uv tool run check-jsonschema==0.39.0 --check-metaschema spec/*.schema.json
uv tool run check-jsonschema==0.39.0 --schemafile spec/errors.schema.json spec/errors.json
uv tool run check-jsonschema==0.39.0 --schemafile spec/vector.schema.json spec/vectors/*/*.json
```

## Vector format

Dishes in vectors are written as:

| Type | Form |
|---|---|
| bytes | `{"type": "bytes", "hex": "<lower-case hex>"}` |
| string | `{"type": "string", "text": "…"}`. JSON `\uXXXX` escapes may encode lone surrogates. |
| integer | `{"type": "integer", "value": n}`. Values beyond 2^53−1 are decimal strings. |
| float, json | `{"type": …, "value": …}` |
| codepoints | `{"type": "codepoints", "values": [n, …]}` |
| table | `{"type": "table", "value": {"columns": […], "rows": […]}}` |

`expected` is a dish, or `{"error": "<E_CODE>"}`. An optional `warnings` array lists the expected warning codes. A case's `args` holds only the arguments it sets; every other argument takes its default.

Every operation needs at least 8 cases: empty input, ASCII, non-BMP, malformed or edge input, each argument option, and at least one error.

## Rules shared by all operations

- An unknown argument name, a value of the wrong type or a value outside the allowed set is `E_ARG_INVALID`.
- A string input is converted to bytes as UTF-8, and a lone surrogate becomes U+FFFD (EF BF BD) (PRD §3.2).
- Bytes are decoded to a string with UTF-8 using maximal-subpart U+FFFD substitution, and a BOM is kept.

## Operation arguments (encoding category)

These tables are normative until `ops.json` is generated from the op registry.

### `to-base64` (bytes → string) and `from-base64` (string → bytes)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `alphabet` | `standard` \| `url` \| `custom` | `standard` | `standard` is RFC 4648 §4 (`+/`). `url` is RFC 4648 §5 (`-_`). |
| `custom` | string | none | Required when `alphabet` is `custom`. 64 unique characters, plus an optional 65th character that is the pad (default `=`). Any other length, a duplicate, or a pad that is also in the alphabet is `E_ARG_INVALID`. |
| `padding` | boolean | `true` | `to-base64` only. Pad the output to a multiple of 4. |
| `strict` | boolean | `false` | `from-base64` only. See below. |

`from-base64` without `strict` discards every character outside the alphabet, including the pad, and decodes the rest. A final group of one character is `E_DECODE`.

With `strict`, the input must hold only alphabet characters, followed by exactly the padding needed to reach a multiple of 4, and the unused trailing bits must be zero. Anything else is `E_DECODE`.

### `to-base32` (bytes → string) and `from-base32` (string → bytes)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `alphabet` | `rfc4648` \| `hex` | `rfc4648` | RFC 4648 §6 (`A–Z2–7`) or §7 "base32hex" (`0–9A–V`). |
| `padding` | boolean | `true` | `to-base32` only. Pad with `=` to a multiple of 8. |
| `strict` | boolean | `false` | `from-base32` only. |

`from-base32` without `strict` is case-insensitive and discards every other character outside the alphabet. A final group of 1, 3 or 6 characters is `E_DECODE`.

With `strict`, the input must be upper case, padded to a multiple of 8 and have zero trailing bits.

### `to-hex` (bytes → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `delimiter` | `none` \| `space` \| `comma` \| `colon` \| `newline` \| `0x` \| `\x` | `space` | Separator between bytes. `0x` and `\x` are prefixes on every byte with no separator, as in CyberChef (`0x660x6f`). |
| `case` | `lower` \| `upper` | `lower` | Case of the hex digits. |

### `from-hex` (string → bytes)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `delimiter` | `auto` or any `to-hex` delimiter | `auto` | How the input is split. |

`auto` removes `0x`, `0X` and `\x`, then whitespace and `,:;-`. Any other non-hex character, or an odd number of digits, is `E_DECODE`. Hex digits may be either case.

An explicit delimiter requires exactly two hex digits per byte, separated or prefixed exactly as `to-hex` writes them. Anything else is `E_DECODE`.

### `url-encode` (string → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `component` \| `all` \| `reserved-only` | `component` | Which characters to percent-encode. |

The output uses upper-case hex over the UTF-8 bytes of the input.

- `component` keeps only the RFC 3986 unreserved characters (`A–Z a–z 0–9 - . _ ~`) and encodes every other byte.
- `all` encodes every byte.
- `reserved-only` encodes only the 18 RFC 3986 reserved characters (`:/?#[]@!$&'()*+,;=`) and `%`. It leaves all other characters, including non-ASCII ones, as they are.

### `url-decode` (string → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `plus-as-space` | boolean | `false` | Turn a literal `+` into a space (form encoding). `%2B` always stays `+`. |

`%XX` with two hex digits of either case becomes that byte. A `%` that is not followed by two hex digits is kept as-is. The resulting bytes are decoded as UTF-8 with maximal-subpart U+FFFD substitution, so this operation never fails on its input.

### `encode-text` (string → bytes) and `decode-text` (bytes → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `encoding` | `utf-8` \| `utf-16le` \| `utf-16be` \| `utf-32le` \| `utf-32be` \| `iso-8859-1` \| `windows-1252` \| `ascii` | `utf-8` | Character encoding. |
| `errors` | `replace` \| `strict` | `replace` | What to do with input that cannot be converted. `strict` makes it `E_DECODE`. |

- `windows-1252` follows the WHATWG Encoding Standard index. Bytes 81, 8D, 8F, 90 and 9D map to U+0081, U+008D, U+008F, U+0090 and U+009D.
- `iso-8859-1` maps each byte to the code point with the same value. Unlike WHATWG, it is not an alias for `windows-1252`.

`encode-text`:

- Lone surrogates become U+FFFD before encoding, in both modes.
- A character the encoding cannot represent becomes `?` (3F) in `replace` mode.
- No BOM is written.

`decode-text`:

- UTF-8 uses maximal-subpart U+FFFD substitution. For example, `C0 80` becomes two U+FFFD and `E0 80 41` becomes U+FFFD U+FFFD `A`.
- UTF-16 and UTF-32: a lone surrogate, a code point above U+10FFFF, or a trailing partial unit each becomes one U+FFFD.
- `ascii`: each byte above 7F becomes U+FFFD.
- A BOM is kept as U+FEFF in every encoding.

### `to-binary`, `to-octal`, `to-decimal` (bytes → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `delimiter` | `space` \| `comma` \| `colon` \| `newline` \| `none` | `space` | Separator between bytes. `to-decimal` has no `none`. |

Binary bytes are padded to 8 digits and octal bytes to 3. Decimal bytes are not padded.

### `from-binary`, `from-octal`, `from-decimal` (string → bytes)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `delimiter` | `auto` or any delimiter of the matching `to-*` op | `auto` | How the input is split. |

- `auto` splits on runs of whitespace and `,:;` and ignores empty tokens.
- An explicit delimiter splits on exactly that character, so an empty token is an error.
- `none` (binary and octal only) reads fixed groups of 8 or 3 digits. A length that is not a multiple of the group size is an error.
- Each token is 1–8 binary, 1–3 octal or 1–3 decimal digits, with a value of at most 255. Anything else, including signs and prefixes, is `E_DECODE`.
- Empty input gives empty bytes.

### `html-entity-encode` (string → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `scope` | `special` \| `non-ascii` \| `all` | `special` | Which characters to encode: the five characters `& < > " '`, those plus every non-ASCII character, or every character. |
| `format` | `named` \| `decimal` \| `hex` | `named` | The reference form. |

- `named` uses the WHATWG names that end in `;` and stand for one code point. When several names exist, the shortest wins, and a tie goes to the name greatest in code-point order (`&lt;`, not `&LT;`). A character with no name falls back to hex.
- Hex references use upper-case digits without padding (`&#xE9;`).
- An astral character gets one reference for its code point, never a surrogate pair.

### `html-entity-decode` (string → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `strict` | boolean | `false` | Fail with `E_DECODE` on a missing semicolon, an unknown `&name;`, or a numeric reference to an invalid code point. |

Decoding follows the HTML tokenizer's character-reference rules for text content, using the pinned list in `data/html/`:

- A named reference takes the longest known name. Legacy names may omit the `;`, so `&notit;` becomes `¬it;`.
- `&#D` and `&#xH` may omit the `;`.
- 0, surrogates and values above 10FFFF become U+FFFD. 80–9F map through windows-1252, so `&#128;` becomes `€`.
- An `&` that starts no reference is kept as it is.

## Operation arguments (unicode category)

### `escape-unicode` (string → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `format` | `backslash-u` \| `backslash-u-braces` \| `backslash-big-u` \| `u-plus` \| `html-hex` \| `html-decimal` \| `percent-u` | `backslash-u` | `\uXXXX`, `\u{X}`, `\UXXXXXXXX`, `U+XXXX`, `&#xX;`, `&#D;` or `%uXXXX`. |
| `scope` | `non-ascii` \| `all` \| `non-printable` | `non-ascii` | Which characters to escape. |

- Hex digits are upper case.
- `backslash-u` and `percent-u` write astral characters as surrogate pairs.
- `non-printable` means General_Category C\*, Zl or Zp, Zs other than U+0020, or Default_Ignorable_Code_Point.

### `unescape-unicode` (string → string)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `format` | `all` or any `escape-unicode` format | `all` | Which escapes to recognise. |

- `\u{…}` takes 1–6 hex digits. `U+` takes 4–6. `&#x…;` and `&#…;` need the `;`.
- Adjacent high and low surrogates of the same UTF-16 format (`\u` or `%u`) combine into one character. Any other surrogate becomes U+FFFD.
- An escape above 10FFFF is left as it is.

### `normalize`, `unicode-case`, `strip-diacritics`, `grapheme-split` (string → string)

- `normalize`: `form` is `NFC` (default), `NFD`, `NFKC` or `NFKD` (UAX #15).
- `unicode-case`:
  - `mode` is `upper` (default), `lower`, `title` or `fold`.
  - `locale` is `none`, `tr`, `az` or `lt`.
  - `simple` switches `fold` to simple folding.
  - Full mappings and Final_Sigma apply. `title` title-cases a cased character that no letter, mark or number precedes (case-ignorable characters such as apostrophes are skipped) and lower-cases the rest.
- `strip-diacritics`:
  - Applies NFD, removes each code point that is gc Mn, Script Inherited and Diacritic, then applies NFC.
  - Script-specific marks, such as the Devanagari virama, are kept.
  - Letters with no decomposition (`ø`, `ł`) are unchanged.
- `grapheme-split`: joins the UAX #29 extended grapheme clusters with `delimiter` (default LF).

### `to-code-points` (codepoints → string) and `from-code-points` (string → codepoints)

- `to-code-points`:
  - `format` is `u-plus` (`U+0041`), `hex` (`0041`), `0x` (`0x0041`) or `decimal` (`65`). Hex forms have at least 4 upper-case digits.
  - `delimiter` is `space`, `comma` or `newline`.
  - A surrogate in a `codepoints` dish is written as it is.
- `from-code-points`:
  - Splits on runs of whitespace, `,` and `;`.
  - A `U+`, `u+`, `0x` or `0X` prefix always means hex. Bare tokens use `base` (`hex` by default, or `decimal`).
  - A value above 10FFFF or a malformed token is `E_DECODE`.
  - Surrogates are kept. They become U+FFFD only if the dish is later turned into text.

### `count` (bytes → integer)

`unit` is `bytes`, `utf16-units`, `code-points` (default), `graphemes` or `lines`.

- Units other than `bytes` decode the input as UTF-8 first, so each ill-formed sequence counts as U+FFFD.
- `lines` counts LF-separated lines. A final LF does not start a new line, and empty input has 0 lines.

### `analyse-characters` (string → table)

The columns are those of PRD §4.6. `granularity` is `codepoint` (default) or `grapheme`.

Cell formats:

| Column | Format |
|---|---|
| `name` | A correction alias first, then the name, then a control alias, then a label such as `<reserved-0378>`. |
| `script`, `scx` | Four-letter script codes. `scx` codes are space-separated. |
| `utf8`, `utf16` | Upper-case hex, space-separated. |
| `decomposition` | The single-level mapping in UnicodeData style (`<compat> 0020 0308`), Hangul included. |
| `char` | The character itself, with these exceptions. Controls, format characters, Zl, Zp, unassigned, private-use, surrogate, White_Space and default-ignorable characters show as `⟨name⟩`. A nonspacing mark at the start of a row gets U+25CC before it. |

`flags`:

- `zero-width` is U+180E, U+200B–U+200D, U+2060 or U+FEFF.
- `unassigned` excludes noncharacters.
- `confusable` means the character has a `confusables.txt` mapping.
- `mixed-script` applies only when the UTS #39 resolved script set of the whole input is empty. It then marks the characters whose augmented script set lacks the majority Script. The majority is counted over characters whose Script is not Common or Inherited, and a tie goes to the smallest script code.

In `grapheme` mode, each row is one cluster:

- `index` is the inclusive code-point range `start-end`.
- `cp`, `utf8` and `utf16` are joined with spaces.
- The other per-code-point columns are joined with ` + `. A column that is empty for every code point stays empty.
- The flags of the cluster are merged.
