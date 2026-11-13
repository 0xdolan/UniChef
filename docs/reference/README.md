<!-- docs:crumbs -->
[Docs](../README.md) › Reference
<!-- /docs:crumbs -->

# Operation reference

One page per operation, grouped by category as in the web app's operation list. Each page
explains how the operation works with a worked example, lists its arguments and tested
examples, and shows how to run it in the web app, the CLI, Python and TypeScript.

<!-- docs:index -->
## Encoding

Background: [Base encodings](../learn/base-encodings.md)

| Operation | What it does |
|---|---|
| [Decode Text](ops/decode-text.md) | Decode bytes from a character encoding. |
| [Encode Text](ops/encode-text.md) | Encode text in a character encoding. |
| [Escape String](ops/escape-string.md) | Escape a string for a JavaScript literal the way jsesc does. |
| [From Base](ops/from-base.md) | Read a number written in a radix from 2 to 36 and write it in decimal. |
| [From Base32](ops/from-base32.md) | Decode Base32. |
| [From Base45](ops/from-base45.md) | Decode Base45 (RFC 9285). |
| [From Base58](ops/from-base58.md) | Decode Base58. |
| [From Base62](ops/from-base62.md) | Decode a base-62 number to bytes. |
| [From Base64](ops/from-base64.md) | Decode Base64. |
| [From Base85](ops/from-base85.md) | Decode Ascii85 (optionally inside `<~ ~>`) or Z85. |
| [From Base92](ops/from-base92.md) | Decode Base92. |
| [From BCD](ops/from-bcd.md) | Read binary-coded decimal back into a decimal integer. |
| [From Bech32](ops/from-bech32.md) | Check the checksum of a Bech32 or Bech32m string and write its data as hex. |
| [From Binary](ops/from-binary.md) | Read bytes of 1-8 binary digits. |
| [From Braille](ops/from-braille.md) | Replace each six-dot Braille pattern (U+2800 to U+283F) with its North American Braille ASCII character; letters come out in upper case. |
| [From Charcode](ops/from-charcode.md) | Read code points written in `base` and separated by `delimiter`. |
| [From Decimal](ops/from-decimal.md) | Read bytes of 1-3 decimal digits (at most 255). |
| [From Float](ops/from-float.md) | Read decimal numbers separated by `delimiter` and write each as an IEEE 754 `float` (4 bytes) or `double` (8 bytes), rounded to the nearest value. |
| [From Hex](ops/from-hex.md) | Read hex digit pairs. |
| [From Hex Content](ops/from-hex-content.md) | Read Snort content: hex between pipes becomes those bytes and the rest is UTF-8. |
| [From Hexdump](ops/from-hexdump.md) | Read the bytes back from a hexdump in the xxd, hexdump -C, Wireshark or 010 Editor style: on each line, an optional offset and then the hex columns. |
| [From Modhex](ops/from-modhex.md) | Read Modhex digit pairs, in either case, ignoring whitespace. |
| [From Morse code](ops/from-morse-code.md) | Read International Morse code. |
| [From Octal](ops/from-octal.md) | Read bytes of 1-3 octal digits (at most 377). |
| [From Punycode](ops/from-punycode.md) | Decode Punycode (RFC 3492). |
| [Hex to PEM](ops/hex-to-pem.md) | Write hex bytes (usually DER) as a PEM block: a BEGIN line with the `header` label, the bytes as Base64 in lines of 64 characters, and an END line. |
| [HTML Entity Decode](ops/html-entity-decode.md) | Decode named and numeric character references as HTML does in text content: the longest known name wins, legacy names may omit the semicolon, numeric references may omit it, 0x80-0x9F map through windows-1252, and 0, surrogates and values above 10FFFF become U+FFFD. |
| [HTML Entity Encode](ops/html-entity-encode.md) | Replace characters with references. |
| [IDNA To ASCII](ops/idna-to-ascii.md) | UTS #46 ToASCII with nontransitional processing: map, normalise to NFC, check every label, and encode non-ASCII labels as xn-- plus Punycode. |
| [IDNA To Unicode](ops/idna-to-unicode.md) | UTS #46 ToUnicode with nontransitional processing: map, normalise to NFC, decode xn-- labels and check every label. |
| [PEM to Hex](ops/pem-to-hex.md) | Find each PEM block (BEGIN and END lines with the same label), decode its Base64 body and write the bytes as hex, one line per block. |
| [Quoted-Printable Decode](ops/quoted-printable-decode.md) | Decode quoted-printable. |
| [Quoted-Printable Encode](ops/quoted-printable-encode.md) | Encode bytes as quoted-printable, with lines of at most 76 characters. |
| [Swap Endianness](ops/swap-endianness.md) | Reverse the byte order inside each word of `word_length` bytes. |
| [Text-Integer Conversion](ops/text-integer.md) | Convert between text and the big-endian integer its bytes spell: `ABC` is 0x414243 is 4276803. |
| [To Base](ops/to-base.md) | Write a decimal number in a radix from 2 to 36 with lower-case digits. |
| [To Base32](ops/to-base32.md) | Encode bytes as Base32 (RFC 4648 §6) or base32hex (§7). |
| [To Base45](ops/to-base45.md) | Encode bytes as Base45 (RFC 9285), the QR-code encoding: 2 bytes become 3 characters. |
| [To Base58](ops/to-base58.md) | Encode bytes as Base58. |
| [To Base62](ops/to-base62.md) | Write the bytes, read as one big-endian number, in base 62. |
| [To Base64](ops/to-base64.md) | Encode bytes as Base64 (RFC 4648 §4 or §5, or a custom alphabet). |
| [To Base85](ops/to-base85.md) | Encode bytes as Ascii85 (`z` for a group of four zero bytes) or Z85. |
| [To Base92](ops/to-base92.md) | Encode bytes as Base92: every 13 bits become two printable ASCII characters. |
| [To BCD](ops/to-bcd.md) | Write a decimal integer as binary-coded decimal: four bits per digit in the chosen `scheme`. |
| [To Bech32](ops/to-bech32.md) | Encode bytes as Bech32 or Bech32m: the human-readable part `hrp`, a `1`, the data in a 32-character alphabet and a six-character checksum. |
| [To Binary](ops/to-binary.md) | Write each byte as eight binary digits, separated by `delimiter`. |
| [To Braille](ops/to-braille.md) | Replace each character of North American Braille ASCII (space, ASCII letters in either case, digits and `!"#$%&'()*+,-./:;<=>?@[\]^_`) with its six-dot Braille pattern, U+2800 to U+283F. |
| [To Charcode](ops/to-charcode.md) | Write each code point in `base`. |
| [To Decimal](ops/to-decimal.md) | Write each byte as a decimal number without padding, separated by `delimiter`. |
| [To Float](ops/to-float.md) | Read the bytes as IEEE 754 numbers, 4 bytes each for `float` or 8 for `double`, and write them in decimal joined by `delimiter`. |
| [To Hex](ops/to-hex.md) | Write each byte as two hex digits, separated or prefixed by `delimiter`. |
| [To Hex Content](ops/to-hex-content.md) | Write bytes as Snort content: ASCII letters, digits and spaces stay as they are and every other byte goes between pipes as hex. |
| [To Hexdump](ops/to-hexdump.md) | Write `width` bytes per line: the offset, the bytes in hex and the bytes as Latin-1 text, with controls and the soft hyphen as dots (`ascii_only` keeps only printable ASCII). |
| [To Modhex](ops/to-modhex.md) | Write each byte as two Modhex digits, separated by `delimiter`. |
| [To Morse code](ops/to-morse-code.md) | Write each character as International Morse code. |
| [To NATO alphabet](ops/to-nato-alphabet.md) | Replace each ASCII letter, digit, `,`, `/` and `.` with its NATO spelling word and a space. |
| [To Octal](ops/to-octal.md) | Write each byte as three octal digits, separated by `delimiter`. |
| [To Punycode](ops/to-punycode.md) | Encode the input with Punycode (RFC 3492). |
| [Unescape String](ops/unescape-string.md) | Replace backslash escapes: \n \r \t \b \f \v \a, quotes and backslash, octal \nnn, hex \xnn, \unnnn (surrogate pairs combine) and \u{n...}. |
| [URL Decode](ops/url-decode.md) | Decode %XX escapes; malformed escapes stay as they are. |
| [URL Encode](ops/url-encode.md) | Percent-encode with upper-case hex over the UTF-8 bytes of the input. |

## Unicode

Background: [Unicode](../learn/unicode.md)

| Operation | What it does |
|---|---|
| [Analyse Characters](ops/analyse-characters.md) | One row per code point (or grapheme cluster) with the columns of PRD §4.6. |
| [Count](ops/count.md) | Count bytes, or decode UTF-8 (U+FFFD for ill-formed input) and count UTF-16 units, code points, grapheme clusters or lines (LF-separated; a final LF does not start a new line). |
| [Escape Unicode](ops/escape-unicode.md) | Write characters as escapes with upper-case hex. |
| [Filter by Property](ops/filter-by-property.md) | Keep or remove the code points whose property has one of the comma-separated `value`s. |
| [From Code Points](ops/from-code-points.md) | Read code points separated by whitespace, commas or semicolons. |
| [Grapheme Split](ops/grapheme-split.md) | Join the extended grapheme clusters (UAX #29) with `delimiter`. |
| [Normalize](ops/normalize.md) | Apply a Unicode normalization form (UAX #15) from the pinned UCD. |
| [Show Bidi Classes](ops/show-bidi-classes.md) | One row per code point with its Bidi_Class (short and long name) and whether it is Bidi_Mirrored. |
| [Strip Diacritics](ops/strip-diacritics.md) | NFD, then drop nonspacing marks that are Diacritic and of the Inherited script, then NFC. |
| [To Code Points](ops/to-code-points.md) | Write each code point as `U+0041`, `0041`, `0x0041` or `65`. |
| [Unescape Unicode](ops/unescape-unicode.md) | Replace escapes with characters; `all` recognises every format. |
| [Unicode Case](ops/unicode-case.md) | Full case mapping with Final_Sigma and the `tr`, `az` and `lt` tailorings. |
| [UTF-8 Explain](ops/utf8-explain.md) | One row per byte: its bits, its role in the UTF-8 structure and, on the first byte of each sequence, the code point it encodes. |

## Security

Background: [Unicode security](../learn/unicode-security.md)

| Operation | What it does |
|---|---|
| [Detect Confusables](ops/detect-confusables.md) | UTS #39 skeletons (NFD, confusables.txt, NFD). |
| [Detect Invisible Characters](ops/detect-invisible.md) | One row per invisible code point: bidi controls (Trojan Source, CVE-2021-42574), tag characters, variation selectors, zero-width characters, Hangul fillers and other default-ignorables. |
| [Remove Bidi Controls](ops/remove-bidi-controls.md) | Delete every Bidi_Control character (U+061C, U+200E, U+200F, U+202A..U+202E, U+2066..U+2069). |
| [Script Mix Check](ops/script-mix-check.md) | The UTS #39 restriction level of the whole input: ASCII-Only, Single Script, Highly Restrictive, Moderately Restrictive, Minimally Restrictive or Unrestricted. |

## Hashing

Background: [Hashing](../learn/hashing.md)

| Operation | What it does |
|---|---|
| [Adler-32](ops/adler32.md) | Adler-32 (RFC 1950) as 8 hex digits. |
| [BLAKE2b](ops/blake2b.md) | BLAKE2b (RFC 7693); `size` is the digest length in bytes (1-64, default 64) and `key` an optional key of up to 64 bytes. |
| [BLAKE2s](ops/blake2s.md) | BLAKE2s (RFC 7693); `size` is the digest length in bytes (1-32, default 32) and `key` an optional key of up to 32 bytes. |
| [CRC-32](ops/crc32.md) | CRC-32 (ISO-HDLC, as in zlib and PNG) as 8 hex digits. |
| [HMAC](ops/hmac.md) | HMAC (RFC 2104) with `hash` (default sha256) and a bytes `key`. |
| [MD5](ops/md5.md) | MD5 digest (RFC 1321). |
| [SHA-1](ops/sha1.md) | SHA-1 digest (FIPS 180-4). |
| [SHA-2](ops/sha2.md) | SHA-2 digest (FIPS 180-4); `size` is 256 (default), 224, 384, 512, 512-224 or 512-256. |
| [SHA-3](ops/sha3.md) | SHA-3 digest (FIPS 202); `size` is 256 (default), 224, 384 or 512. |
| [SHAKE](ops/shake.md) | SHAKE extendable-output function (FIPS 202); `size` is 128 (default) or 256 and `length` is the output length in bytes (default 32). |

## Crypto

Background: [Encryption](../learn/encryption.md)

| Operation | What it does |
|---|---|
| [A1Z26 decode](ops/a1z26-decode.md) | Split on `delimiter` and write each number from 1 to 26 as a lower-case letter. |
| [A1Z26 encode](ops/a1z26-encode.md) | Write each ASCII letter as its place in the alphabet (`a` and `A` are 1, `z` and `Z` are 26), joined by `delimiter`. |
| [AES Decrypt](ops/aes-decrypt.md) | Inverse of `aes-encrypt` with the same arguments. |
| [AES Encrypt](ops/aes-encrypt.md) | AES in CBC (default), CTR, GCM or ECB mode. |
| [Atbash](ops/atbash.md) | Mirror the ASCII alphabet (A<->Z, case kept). |
| [Bacon cipher decode](ops/bacon-decode.md) | Read Bacon codes as upper-case letters. |
| [Bacon cipher encode](ops/bacon-encode.md) | Write each ASCII letter as a five-symbol Bacon code. |
| [Generate Random Bytes](ops/generate-random-bytes.md) | Replace the input with `length` random bytes: from the platform's secure random generator, or, when the recipe has a `seed`, from SHA-256 in counter mode. |
| [JWT Decode](ops/jwt-decode.md) | Split a JWT into `header`, `payload` and `signature` (base64url text), without checking the signature or time claims. |
| [JWT Sign](ops/jwt-sign.md) | Sign a JSON object as a JWT. |
| [JWT Verify](ops/jwt-verify.md) | Check a JWT's signature and return its payload. |
| [PBKDF2](ops/pbkdf2.md) | Derive a `length`-byte key from the input password (PBKDF2-HMAC, RFC 8018) and return it as hex. |
| [ROT13](ops/rot13.md) | Rotate ASCII letters by `amount` (default 13, case kept); with `digits`, also rotate 0-9 by the same amount mod 10. |
| [ROT47](ops/rot47.md) | Rotate printable ASCII U+0021..U+007E by `amount` (default 47) mod 94. |
| [ROT8000](ops/rot8000.md) | Rotate visible Basic Multilingual Plane characters halfway through the list of 63 404 that take part, so applying it twice gives the input back. |
| [Vigenère Decode](ops/vigenere-decode.md) | Undo `vigenere-encode`: shift each ASCII letter back by the next letter of `key`. |
| [Vigenère Encode](ops/vigenere-encode.md) | Shift each ASCII letter forward by the next letter of `key` (A=0, case kept). |
| [XOR](ops/xor.md) | XOR with a repeating `key`. |

## Compression

Background: [Compression](../learn/compression.md)

| Operation | What it does |
|---|---|
| [Gunzip](ops/gunzip.md) | Decompress gzip data (RFC 1952), member after member, checking each CRC-32 and length. |
| [Gzip](ops/gzip.md) | Compress to one gzip member (RFC 1952) with no file name, a zero modification time and OS 255 (unknown), so the output does not depend on when or where it is made. |
| [Raw Deflate](ops/raw-deflate.md) | Compress to a raw DEFLATE stream (RFC 1951) with no header or checksum. |
| [Raw Inflate](ops/raw-inflate.md) | Decompress a raw DEFLATE stream (RFC 1951). |
| [Zlib Deflate](ops/zlib-deflate.md) | Compress to the zlib format (RFC 1950): a 2-byte header, raw DEFLATE and an Adler-32 checksum. |
| [Zlib Inflate](ops/zlib-inflate.md) | Decompress zlib data (RFC 1950) and check its Adler-32. |

## Data

Background: [Data formats and text processing](../learn/data-and-text.md)

| Operation | What it does |
|---|---|
| [Cartesian Product](ops/cartesian-product.md) | Split the input on `sample_delimiter` into two or more samples and each sample on `item_delimiter` into items. |
| [CSV to JSON](ops/csv-to-json.md) | Parse RFC 4180 CSV. |
| [Hamming Distance](ops/hamming-distance.md) | Split the input on `delimiter` into two samples of equal length, read as UTF-8 text or as hex (whitespace ignored). |
| [JSON Beautify](ops/json-beautify.md) | Write JSON with one value per line, like `JSON.stringify(v, null, indent)`. |
| [JSON Minify](ops/json-minify.md) | Write JSON with no whitespace, keeping key order. |
| [JSON to CSV](ops/json-to-csv.md) | Write an array of objects (with a header row) or an array of arrays as CSV. |
| [Levenshtein Distance](ops/levenshtein-distance.md) | Split the input on `delimiter` into two samples. |
| [Parse Query String](ops/parse-query-string.md) | Split `name=value` pairs on `&` and percent-decode them as UTF-8. |
| [Parse URL](ops/parse-url.md) | Split a URL into its RFC 3986 parts without decoding or normalising them. |
| [Power Set](ops/power-set.md) | Split the input on `item_delimiter` into items, dropping empty ones and repeats. |
| [Set Difference](ops/set-difference.md) | Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. |
| [Set Intersection](ops/set-intersection.md) | Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. |
| [Set Union](ops/set-union.md) | Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. |
| [Symmetric Difference](ops/symmetric-difference.md) | Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. |

## Text

Background: [Data formats and text processing](../learn/data-and-text.md)

| Operation | What it does |
|---|---|
| [Add line numbers](ops/add-line-numbers.md) | Put the line number and a space before each line, counting from `offset` + 1. |
| [Alternating caps](ops/alternating-caps.md) | Lower-case the first letter, upper-case the next, and so on. |
| [Escape Smart Characters](ops/escape-smart-characters.md) | Replace typographic characters (curly quotes, dashes, ellipsis, ©, ®, ™, arrows and some spaces) with plain ASCII. |
| [Find / replace](ops/find-replace.md) | Replace matches of `pattern` with `replacement`. |
| [Get all casings](ops/get-all-casings.md) | Every combination of upper and lower case, one per line. |
| [Head](ops/head.md) | The first `count` lines (keeping a final LF), graphemes or code points. |
| [Join lines](ops/join.md) | Join the lines with `delimiter`. |
| [Leet speak](ops/leet-speak.md) | `to` replaces the ASCII letters a, e, i, o, s and t, in either case, with 4, 3, 1, 0, 5 and 7. |
| [Pad lines](ops/pad-lines.md) | Add `length` code points to the start or end of each line, made by repeating `character` and cutting it to length. |
| [Regex extract](ops/regex-extract.md) | List every match of `pattern` (or its capture group `group`), joined by `separator`. |
| [Remove ANSI escape codes](ops/remove-ansi-escape-codes.md) | Remove ANSI control sequences (ESC `[`, parameter bytes, intermediate bytes and a final byte), such as colour and cursor codes. |
| [Remove line numbers](ops/remove-line-numbers.md) | At the start of each line, remove up to five spaces or tabs, ASCII digits and one following separator: whitespace (including a line feed) or one of `:\|-,.)]`. |
| [Remove null bytes](ops/remove-null-bytes.md) | Remove every 0x00 byte. |
| [Reverse](ops/reverse.md) | Reverse the order of graphemes (default), code points or bytes. |
| [Sort lines](ops/sort-lines.md) | Stable sort of the lines. |
| [Split](ops/split.md) | Split on the literal `delimiter` and join the parts with `join`. |
| [Strip HTML tags](ops/strip-html-tags.md) | Remove everything from `<` to the next `>`, repeating until none is left. |
| [Swap case](ops/swap-case.md) | Upper-case every character that changes when upper-cased, and lower-case the rest, one code point at a time with full case mappings (`ß` becomes `SS`). |
| [Tail](ops/tail.md) | The last `count` lines (keeping a final LF), graphemes or code points. |
| [To Camel case](ops/to-camel-case.md) | Like To Snake case, but the first word is lower case and every later word is title case, with nothing between them. |
| [To Kebab case](ops/to-kebab-case.md) | Like To Snake case, but the words are joined with hyphens. |
| [To Snake case](ops/to-snake-case.md) | Split the text into words and join them in lower case with underscores. |
| [Trim](ops/trim.md) | Remove White_Space characters from the start, end or both ends of the text, or of every line with `lines` (a final LF is kept). |
| [Unique lines](ops/unique-lines.md) | Keep the first of each set of equal lines, in input order. |
| [Wrap](ops/wrap.md) | Break each line into lines of at most `width` characters. |

## Flow

Background: [How UniChef works](../learn/how-unichef-works.md)

| Operation | What it does |
|---|---|
| [Comment](ops/comment.md) | An annotation. |
| [Conditional jump](ops/conditional-jump.md) | Jump to the label `to` when `pattern` matches the dish (or does not, with `invert`), at most `max` times; then continue with a W_JUMP_LIMIT warning. |
| [Fork](ops/fork.md) | Split the input on `split`, run `steps` on each part, and join the results with `merge`. |
| [Jump](ops/jump.md) | Jump to the label `to`, at most `max` times; then continue with a W_JUMP_LIMIT warning. |
| [Label](ops/label.md) | A jump target. |
| [Sub-recipe](ops/sub-recipe.md) | Run `steps` as one group. |
| [Subsection](ops/subsection.md) | Run `steps` on each match of `pattern` (or on its capture group `group`) and splice the results back; the rest of the dish passes through. |
<!-- /docs:index -->

<!-- docs:nav -->
---

[← Sets and distances: comparing lists and strings](../learn/sets-and-distances.md) · [Contents](../README.md) · [Decode Text →](ops/decode-text.md)
<!-- /docs:nav -->
