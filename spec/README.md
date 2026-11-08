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

### Bytes arguments

A bytes argument (a key, IV, AAD and so on) is written in a recipe as `{"encoding": "<enc>", "value": "<string>"}`, with exactly those two members.

| `encoding` | Meaning of `value` |
|---|---|
| `hex` | Hex digit pairs, either case. Whitespace between pairs is allowed. |
| `utf8` | Text, encoded as UTF-8. |
| `base64` | Strict RFC 4648 base64: padding is required, and any non-alphabet character is an error. |
| `latin1` | Text in which every character is U+0000..U+00FF, and each becomes one byte. |

Anything else raises `E_ARG_INVALID` when the recipe is loaded. This covers a wrong shape, an encoding the argument does not allow, or a value that does not decode. The default is the empty byte string, given in the first allowed encoding.

### Table to string

A table becomes a string as TSV:

- The first line is the header row, and lines are joined with LF. There is no final LF.
- In every cell, `\` becomes `\\`, TAB becomes `\t`, LF becomes `\n` and CR becomes `\r`.
- `null` is written as an empty cell, and booleans as `true` or `false`.
- Integers are written in decimal. Floats use the ECMAScript `Number.prototype.toString()` form.

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

### `to-base58` (bytes → string) and `from-base58` (string → bytes)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `alphabet` | `bitcoin` \| `flickr` | `bitcoin` | `1–9A–HJ–NP–Za–km–z`, or Flickr's order with the lower-case letters first. |
| `strict` | boolean | `false` | `from-base58` only. Any character outside the alphabet is `E_DECODE`. |

The bytes are read as one big-endian number. Each leading zero byte becomes one leading `1` (the alphabet's first digit), and back. Without `strict`, `from-base58` discards every character outside the alphabet, including `0`, `O`, `I` and `l`.

### `to-base85` (bytes → string) and `from-base85` (string → bytes)

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `alphabet` | `ascii85` \| `z85` | `ascii85` | Ascii85 (`!`–`u`) or ZeroMQ Z85. |
| `delimiters` | boolean | `false` | `to-base85` only. Wrap Ascii85 in `<~` and `~>`. With `z85` it is `E_ARG_INVALID`. |
| `strict` | boolean | `false` | `from-base85` only. |

Each group of four bytes is a big-endian number written as five digits. A final group of 1–3 bytes is padded with zero bytes and written as its first 1–3 + 1 digits. Z85 itself requires whole groups; UniChef encodes a final partial group the same way as Ascii85. In Ascii85, a whole group of four zero bytes is written as `z`; a partial final group never is.

`from-base85` with `ascii85` removes one enclosing `<~ … ~>`. Without `strict`, it also trims surrounding whitespace first and discards every character outside the alphabet (and `z`). A final group is padded with the alphabet's last digit. Errors (`E_DECODE`): a `z` inside a group, a final group of one digit, or a group above FFFFFFFF.

With `strict`, every character must be a digit (or `z`), and the input must be exactly what `to-base85` writes for its bytes: `!!!!!` for a zero group, or a non-canonical final group, is `E_DECODE`.

### `quoted-printable-encode` (bytes → string) and `quoted-printable-decode` (string → bytes)

RFC 2045 §6.7.

| Arg | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `text` \| `binary` | `text` | `encode` only. In `text`, LF and CRLF are line breaks, written as CRLF. In `binary`, CR and LF are escaped like other bytes. |
| `strict` | boolean | `false` | `decode` only. |

`quoted-printable-encode` writes bytes 21–7E except `=` as they are, and spaces and tabs as they are unless they end a line. Every other byte is `=XX` in upper-case hex, and a lone CR is `=0D`. Lines longer than 76 characters get soft line breaks (`=` then CRLF), never inside an `=XX`.

`quoted-printable-decode` removes spaces and tabs at the end of each line, and then a final `=` with its line break (a soft break). Other line breaks are kept as LF or CRLF, as written. Without `strict`, `=xx` in lower case is decoded, an `=` that starts no escape is kept as it is, and characters above 7F become their UTF-8 bytes. With `strict`, all three are `E_DECODE`.

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

## Operation arguments (security category)

### `detect-invisible` (string → table)

Columns are `index`, `cp`, `name`, `kind`, `line` and `column`. There is one row per invisible code point.

- `index` is the 0-based code-point offset.
- `line` and `column` are 1-based. Lines are LF-separated, and columns count code points.
- `kind` is the first of these that matches:
  1. `bidi-control` (Bidi_Control).
  2. `tag` (U+E0000..U+E007F).
  3. `variation-selector` (Variation_Selector).
  4. `zero-width` (the `zero-width` set above).
  5. `hangul-filler` (U+115F, U+1160, U+3164, U+FFA0).
  6. `default-ignorable` (Default_Ignorable_Code_Point, U+00AD, U+034F).

### `remove-bidi-controls` (string → string)

Deletes every Bidi_Control character.

### `detect-confusables` (string → table)

The skeleton is UTS #39 §4: NFD, then `confusables.txt`, then NFD.

- **Without `reference`:** columns `index`, `cp`, `name` and `prototype`. There is one row per code point with a mapping, and `prototype` lists `U+XXXX` values separated by spaces.
- **With a non-empty `reference`:** a single row with columns `input-skeleton`, `reference-skeleton` and `confusable`. The skeletons are upper-case hex code points separated by spaces. `confusable` is `true` or `false`.

### `script-mix-check` (string → string)

Returns the UTS #39 §5.2 restriction level of the whole input: `ASCII-Only`, `Single Script`, `Highly Restrictive`, `Moderately Restrictive`, `Minimally Restrictive` or `Unrestricted`.

- **`profile` (default `true`):** applies step 1. Any character whose Identifier_Status is not Allowed makes the input `Unrestricted`. This includes spaces, punctuation and newlines, so turn it off for running text.
- **Highly Restrictive:** the resolved script set of the non-Latin characters contains Hanb, Jpan or Kore.
- **Moderately Restrictive:** that set is non-empty and contains neither Cyrl nor Grek.
- **Empty input:** `ASCII-Only`.

## Operation arguments (hashing category)

All hashing ops take bytes, so string input is hashed as UTF-8. Output is a lower-case hex string.

| Op | Arguments | Notes |
|---|---|---|
| `md5`, `sha1` | none | They warn `W_INSECURE` (PRD SEC-006). |
| `sha2` | `size`: `256` (default), `224`, `384`, `512`, `512-224`, `512-256` | FIPS 180-4. |
| `sha3` | `size`: `256` (default), `224`, `384`, `512` | FIPS 202. |
| `shake` | `size`: `128` (default) or `256`; `length`: output bytes, 1-65536, default 32 | FIPS 202 XOF. |
| `blake2b`, `blake2s` | `size`: digest bytes (1-64, default 64 / 1-32, default 32); `key`: bytes, up to 64 / 32 | RFC 7693. A longer key raises `E_ARG_INVALID`. |
| `crc32`, `adler32` | none | Always 8 hex digits. CRC-32 is ISO-HDLC (zlib, PNG); Adler-32 is RFC 1950. |
| `hmac` | `hash`: `sha256` (default), `sha1`, `md5`, `sha224`, `sha384`, `sha512`, `sha3-256`, `sha3-512`; `key`: bytes | RFC 2104. No warning, because HMAC-MD5 and HMAC-SHA-1 are not broken as MACs. |

## Operation arguments (crypto category)

### `xor` (bytes → bytes)

`key` is required and must not be empty. It repeats over the input.

`scheme`:
- `standard` (default) uses the key as given.
- `rolling` adds the number of completed passes over the key to each key byte, mod 256. Byte `i` is XORed with `(key[i mod n] + floor(i / n)) mod 256`.

Both schemes are their own inverse.

### `rot13`, `rot47`, `atbash` (string → string)

These ops change only ASCII characters.

- **`rot13`** rotates letters by `amount` (default 13; any value in ±1 000 000 is reduced mod 26) and keeps their case. With `digits`, it also rotates `0`-`9` by `amount` mod 10.
- **`rot47`** rotates U+0021..U+007E by `amount` (default 47) mod 94.
- **`atbash`** maps A↔Z and a↔z.

### `aes-encrypt`, `aes-decrypt` (bytes → bytes)

| Arg | Values |
|---|---|
| `key` | 16, 24 or 32 bytes. Anything else raises `E_CRYPTO`. |
| `mode` | `cbc` (default), `ctr`, `gcm`, `ecb`. ECB warns `W_INSECURE`. |
| `iv` | CBC: 16 bytes. CTR: the 16-byte initial counter block (big-endian increment). GCM: an 8-128 byte nonce. Ignored for ECB. A wrong length raises `E_CRYPTO`. |
| `padding` | `pkcs7` (default) or `none`. Applies only to CBC and ECB. With `none`, the data must be a whole number of 16-byte blocks, or `E_CRYPTO` is raised. |
| `aad` | GCM only. In any other mode a non-empty value raises `E_ARG_INVALID`. |

Nothing is random: the IV is always an argument, so the output is deterministic.

In GCM, the 16-byte tag is appended to the ciphertext, and decryption takes it from the last 16 bytes. A tag mismatch or bad PKCS#7 padding raises `E_CRYPTO`.

### `vigenere-encode`, `vigenere-decode` (string → string)

- `key` must be one or more ASCII letters; its case is ignored, and `a` is a shift of 0. An empty key, or one with any other character, raises `E_ARG_INVALID`.
- Encoding shifts each ASCII letter forward by the next key letter, mod 26, and keeps its case. Decoding shifts back.
- Every other character, including non-ASCII letters such as `é` or the Kelvin sign U+212A, is copied unchanged and does not use up a key letter.

CyberChef also treats a few non-ASCII letters as letters (those whose lower case is ASCII, such as U+212A); UniChef does not.

### `pbkdf2` (bytes → string)

PBKDF2-HMAC (RFC 8018 §5.2). The input is the password and the result is the derived key in lower-case hex.

| Arg | Values |
|---|---|
| `hash` | `sha256` (default), `sha1`, `md5`, `sha224`, `sha384`, `sha512`, `sha3-256`, `sha3-512` (the `hmac` list). |
| `iterations` | 1-10 000 000, default 100 000. Below 100 000 it warns `W_INSECURE` (SEC-006). |
| `salt` | Bytes; may be empty. |
| `length` | Derived key length in bytes, 1-1024, default 32. |

The derivation is one library call, so a run can only be cancelled before it starts.

### `generate-random-bytes` (bytes → bytes)

Replaces the input with `length` bytes (1 to 64 MiB, default 32). Parity class `nondeterministic`.

Without a recipe `seed`, the bytes come from the platform's secure random generator (`secrets` in Python, `crypto.getRandomValues` in TypeScript). With a seed, they come from the recipe's seeded stream: SHA-256(seed ‖ counter as 8 big-endian bytes), counter starting at 0, the 32-byte blocks concatenated. Each request for n bytes uses ⌈n/32⌉ blocks and drops the unused tail. The op asks for 64 KiB at a time, so its output equals one request of `length` bytes. The stream continues across steps of the same run, so both cores give the same bytes, which the seeded recipe vectors check.

### JSON Web Tokens: `jwt-decode`, `jwt-sign`, `jwt-verify`

These ops handle JWS compact tokens (RFC 7515/7519). Algorithms: `HS256/384/512`, `RS256/384/512`, `PS256/384/512`, `ES256/384/512` (P-256, P-384 and P-521; the signature is raw `r‖s`) and `EdDSA` (Ed25519 or Ed448). Encrypted tokens (JWE) are not supported.

**Parsing (`jwt-decode` and `jwt-verify`)**
- Leading and trailing ASCII whitespace is removed.
- The token must have exactly three segments. Five segments (JWE) or any other count raises `E_DECODE`.
- Each segment is strict unpadded base64url: no `=`, no `+` or `/`, and zero trailing bits.
- The header and payload must be UTF-8 JSON objects. Breaking any of these rules raises `E_DECODE`.
- Duplicate keys follow the usual JSON rule (`W_DUPLICATE_KEY`).

**Ops**

| Op | Types | Args | Result |
|---|---|---|---|
| `jwt-decode` | string → json | none | `{"header", "payload", "signature"}`. The signature stays as base64url text. Nothing is checked. |
| `jwt-sign` | json → string | `algorithm` (default `HS256`; `none` is also allowed), `key`, `header` | A token. The header is `{"alg", "typ":"JWT"}` followed by the fields in `header`, which must be a JSON object. `header` may replace `typ`. Setting a different `alg` there raises `E_ARG_INVALID`. Header and payload are serialised compactly, as `JSON.stringify` does. |
| `jwt-verify` | string → json | `algorithm` (default `HS256`), `key` | The payload. |

**Inputs and keys**
- The `jwt-sign` input must be a JSON object, otherwise `E_INPUT_TYPE`.
- `key` is a bytes argument, with `utf8` as its first encoding.
  - For `HS*` it is the secret. An empty secret raises `E_ARG_INVALID`.
  - For the others, give an unencrypted PEM or DER key. `jwt-verify` also accepts a public key, an X.509 certificate, or a private key (its public half is used).

**Signatures**
- `none` signing produces an empty signature and warns `W_INSECURE`.
- `PS*` and `ES*` signatures are randomised, so `jwt-sign` is parity class R and those algorithms are tested by sign → verify recipes. The other algorithms are deterministic and tested exactly.

**Warnings**
- An `HS*` secret shorter than the hash output (for example under 256 bits for `HS256`) warns `W_INSECURE`.
- An RSA key under 2048 bits also warns `W_INSECURE`.

**`jwt-verify` checks.** Each of the following raises `E_CRYPTO`:
- The header `alg` is not exactly `algorithm`. This refuses `none` and algorithm-confusion tokens.
- The header has a `crit` field.
- The key type or curve does not fit the algorithm.
- An `ES*` signature has the wrong length.
- The signature does not verify.

Time claims (`exp`, `nbf`, `iat`) are never checked, because ops do not read the clock.

## Operation arguments (data category)

The JSON ops take a `json` dish, so a string input is parsed by the usual strict rules (PRD §3.2 rule 5): invalid JSON raises `E_INPUT_TYPE`, a duplicate key warns `W_DUPLICATE_KEY` and the last one wins, and big integers stay exact. Numbers are written as ECMAScript writes them (`2.50` becomes `2.5`, `1e21` becomes `1e+21`), and a float that overflows becomes `null`.

### `json-beautify` (json → string)

Writes one value per line, as `JSON.stringify(value, null, indent)` does. Empty arrays and objects stay `[]` and `{}`. Strings use the compact form's escapes: non-ASCII text stays literal, and controls and lone surrogates become `\uXXXX`.

| Arg | Values |
|---|---|
| `indent` | `2` (default), `4` or `tab`. |
| `sort_keys` | Sort object keys by code point at every level, default false. Code-point order differs from JavaScript's UTF-16 order: U+FFFF sorts before U+1F600. |

### `json-minify` (json → string)

Writes the value with no whitespace, keeping key order.

### `json-to-csv` (json → string)

The input must be an array whose items are all objects or all arrays; anything else raises `E_INPUT_TYPE`. An empty array gives empty output.

- **Objects:** the header row lists every key in first-seen order. A missing key gives an empty cell.
- **Arrays:** each array is a record, with no header row. Rows may differ in length.
- **Cells:** `null` is empty, booleans are `true` or `false`, numbers are written as above, and nested arrays or objects are written as compact JSON.
- **Quoting (RFC 4180):** a field containing the delimiter, `"`, CR or LF is wrapped in quotes, with each `"` doubled. Other fields are not quoted.
- Every record ends with the line ending, including the last.

| Arg | Values |
|---|---|
| `delimiter` | `comma` (default), `semicolon` or `tab`. |
| `line_ending` | `crlf` (default, as RFC 4180 requires) or `lf`. |

### `csv-to-json` (string → json)

Parses RFC 4180 CSV, with these choices:

- CRLF, LF and a lone CR all end a record. A final line break is optional and does not add a record. A blank line is a record with one empty field.
- A leading U+FEFF (byte order mark) is dropped.
- A quoted field may hold the delimiter, line breaks and doubled quotes `""`.
- Cells stay strings; no number or date guessing.

Each of these raises `E_DECODE`, naming the 1-based record:

- an unclosed quoted field;
- a `"` inside an unquoted field;
- text between a closing quote and the next delimiter or line break;
- with `header`, a record whose field count differs from the header's.

| Arg | Values |
|---|---|
| `delimiter` | `comma` (default), `semicolon` or `tab`. |
| `header` | Default true: the first record names the fields, and each later record becomes an object. A repeated column name warns `W_DUPLICATE_KEY`; the last value wins and takes the last position, as for JSON. Empty input or a header alone gives `[]`. False: each record becomes an array of strings. |

### `parse-url` (string → json)

Splits a URI reference with the RFC 3986 Appendix B pattern and returns an object with the keys `scheme`, `username`, `password`, `host`, `port`, `path`, `query` and `fragment`, in that order. This is not the WHATWG URL parser: nothing is percent-decoded, lower-cased, resolved or IDNA-mapped, so both cores give the same result.

- Leading and trailing ASCII whitespace (space, tab, LF, FF, CR) is removed.
- An absent part is `null`, which differs from an empty one: `http://h:/p?#` has `port` null but `query` and `fragment` `""`. `path` is always a string.
- The userinfo is the authority text before its last `@`. `username` is the text before its first `:`, and `password` the rest (null if there is no `:`).
- A host in `[` `]` (IPv6 or IPvFuture) keeps its brackets. Otherwise the host ends at its first `:`.
- `port` is an integer, written with any number of leading zeros, from 0 to 65535. An empty port is null.

Errors (`E_DECODE`):

- a scheme that does not start with a letter or has a character other than A-Z, a-z, 0-9, `+`, `-` or `.`;
- a port with a non-digit, or above 65535;
- a `[` with no `]`, or text other than `:port` after the `]`.

So `localhost:8080` reads as scheme `localhost` with path `8080`, as RFC 3986 requires. Add `//` to give a host.

### `parse-query-string` (string → json)

Parses `application/x-www-form-urlencoded` text, following the WHATWG rules:

- A leading `?` is dropped. The text is split on `&`, and empty pieces are skipped.
- Each piece splits at its first `=`. A piece with no `=` has an empty value.
- With `plus_as_space`, `+` becomes a space before decoding. `%2B` always decodes to `+`.
- `%XX` escapes are decoded as bytes, and the result is decoded as UTF-8 with U+FFFD for invalid sequences. A `%` not followed by two hex digits stays literal.

| Arg | Values |
|---|---|
| `output` | `object` (default): an object of names to values, in first-seen order. A repeated name collects its values into an array, in order. `pairs`: an array of `[name, value]` arrays that keeps order and repeats. |
| `plus_as_space` | Default true. |

## Regex profile

Patterns use a portable subset of ECMAScript syntax, with the `v` flag's class rules. Both cores parse a pattern with their own parser and expand every class to explicit code-point ranges from the pinned UCD data. Neither core consults its host's Unicode tables or case-folding.

- Flags are distinct letters from `imsx`. An unknown letter or a repeated letter is `E_ARG_INVALID`.
- `i`: every class is closed under simple case folding at parse time. Backreferences under `i` are `E_REGEX_UNSUPPORTED`.
- `m`: `^` and `$` match at line boundaries. Without `m` they match only at the start and end of input.
- `s`: `.` also matches a line terminator. Without `s`, `.` matches any code point except a line terminator.
- `x`: outside a class, ASCII whitespace (space, tab, LF, CR, FF, VT) is ignored, and `#` starts a comment that runs to the end of the line.
- Line terminators are U+000A, U+000D, U+2028 and U+2029.
- All offsets, spans and lengths are code-point indices, never UTF-16 units or bytes.

### Classes and escapes

- `\d`, `\w` and `\s` (and their negations) are the sets `digit()`, `word()` and `space()` in `profile.py`. `\s` is White_Space.
- `\b` and `\B` are word-boundary anchors outside a class.
- Class set operations are `E_REGEX_UNSUPPORTED`.
- Metacharacters (`\ ^ $ . | ? * + ( ) [ ] { }`) match literally only when escaped.

### Properties `\p{…}` and `\P{…}`

- `\p{Name}`: a General_Category value (`Lu`, `Letter`) or a binary property name (`White_Space`, `Alphabetic`).
- `\p{Key=Value}`: accepted only for keys `gc`, `sc`, `scx` and `blk`. Binary properties take `Yes` or `No`.
- Names and values use UAX44-LM3 loose matching: ASCII case, whitespace, `_` and `-` are ignored, and a leading `is` is dropped.
- An unknown name or value is `E_ARG_INVALID`. A bare body that is neither a General_Category value nor a binary property (`\p{Script}`) is `E_ARG_INVALID`.

### Quantifiers

- `*`, `+`, `?`, `{n}`, `{n,}` and `{n,m}`. A following `?` makes the quantifier lazy.
- Counts are at most 65535 (`MAX_REPEAT`). A larger count is `E_ARG_INVALID`.
- Anchors and lookarounds cannot be repeated (`E_ARG_INVALID`). A quantifier with nothing before it is `E_ARG_INVALID`.

### Groups, backreferences and anchors

- Supported: `(…)`, `(?:…)`, `(?=…)`, `(?!…)`, `(?<=…)`, `(?<!…)` and `(?<name>…)`.
- Unsupported (`E_REGEX_UNSUPPORTED`): atomic groups `(?>…)`, conditionals, `(?P…)`, branch reset `(?|…)`, comments `(?#…)`, recursion, and inline flags `(?i)` and `(?i:…)`.
- `\N` and `\k<name>` must name an existing group. The check runs after the whole pattern is parsed; a missing group is `E_ARG_INVALID`.

### Matching

- Alternation and quantifiers are leftmost-first, as in ECMAScript. Quantifiers are greedy unless lazy.
- A group that did not participate has no span (null).
- `finditer` follows JavaScript's `g` flag: matches do not overlap, and after an empty match the search resumes one code point later.
- Replacement templates (`expand`): `$$` is `$`, `$&` is the match, `$n` is group n, and `$nn` is a two-digit group when it exists (1–99). `$<name>` is a named group when the pattern has named groups. `$n` for a group that does not exist is literal. A group that did not participate expands to "".

### Errors and timeouts

- `E_ARG_INVALID` (exit 1): malformed pattern or flags.
- `E_REGEX_UNSUPPORTED` (exit 1): well-formed but outside this profile.
- `E_REGEX_TIMEOUT` (exit 5): the bound is `regex_timeout_ms` (default 2000). For `search` and the predicate it applies to one search. For `finditer` it bounds the whole iteration.
- A recipe load only checks that a `regex` argument is a JSON string. The pattern is translated and compiled when its step runs.

## Flow operations

Flow operations are interpreted by the runner. Every enabled step counts toward the step limit, including `label` and `comment`. A disabled step is skipped before it is counted.

### Labels, jumps and counters

- A label name must be unique within its step list. A duplicate is `E_RECIPE_SCHEMA` ("Duplicate label").
- A `to` that names no label in the same list is `E_RECIPE_SCHEMA` at load. Jumps do not cross step lists.
- Each run of a step list has its own jump counters. Fork branches, subsection matches and sub-recipes each run as a new list, so they start with fresh counters.
- A taken jump whose counter is below `max` moves to the label and increments the counter.
- When a taken jump's counter equals `max`, the runner emits one `W_JUMP_LIMIT` warning, sets the counter to `max + 1` and falls through. Later hits fall through silently. With `max` 0 the first hit warns.
- `max` is an integer from 0 to 1000 (default 10).
- Each jump evaluation, taken or not, counts toward the step limit.

### `fork` (string → string)

Arguments: `split` (default LF), `merge` (default LF), `steps`. An empty `split` splits into code points. Each part is coerced to a string and runs `steps`. The results are joined with `merge`. An error in any branch fails the fork, and its path names the branch.

### `sub-recipe` (any → any)

Argument: `steps`. Runs the steps as a scope. The dish keeps its type, so no coercion is applied at the boundary.

### `label` (any → any)

Argument: `name`. A jump target. Passes the dish through unchanged.

### `comment` (any → any)

Argument: `text`. Passes the dish through unchanged.

### `jump` (string → string)

Arguments: `to` (label), `max` (default 10). Always taken, subject to the counter rules above.

### `conditional-jump` (string → string)

Arguments: `pattern` (regex), `flags`, `invert` (default false), `to`, `max` (default 10). The dish is coerced to a string. The jump is taken when the pattern is found, or when it is not found if `invert` is true. Counter rules apply.

### `subsection` (string → string)

Arguments: `pattern` (regex), `flags`, `group` (0–99, default 0), `global` (default true), `steps`.

- All matches are found before any steps run. With `global` off, only the first match is used.
- For each match whose `group` span is present and non-empty, `steps` run on that span as a string. The results replace the span, and the rest of the dish passes through.
- Empty matches and groups that did not participate are left alone.
- A `group` greater than the pattern's group count is `E_ARG_INVALID`, raised when the step runs.

### Nesting and limits

- Nesting depth above 8 is `E_LIMIT` at load.
- `max_steps` (default 100000) is checked for the whole bake. Exceeding it is `E_LIMIT`.
- Each step's output may be at most `max(4 × input size, 64 MiB)`. Larger output is `E_LIMIT`.
- A Python `RecursionError` or `MemoryError` becomes `E_LIMIT`. Any other unexpected exception becomes `E_INTERNAL`.
