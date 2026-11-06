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
