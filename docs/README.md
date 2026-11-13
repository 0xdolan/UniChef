# UniChef documentation

UniChef is a cybersecurity and Unicode workbench. These pages explain how every operation
works: what it calculates, step by step, why you would use it, and where it can mislead you.
Start with a guide if a topic is new to you, or jump straight to an operation.

Every page has a breadcrumb at the top and previous, contents and next links at the bottom,
so you can read the whole set in order. The same pages open inside the web app: each recipe
step has a "How it works" link to its page.

<!-- docs:toc -->
## Learn

1. [How UniChef works](learn/how-unichef-works.md)
2. [Text and bytes](learn/text-and-bytes.md)
3. [Unicode](learn/unicode.md)
4. [Base encodings](learn/base-encodings.md)
5. [Web encodings](learn/web-encodings.md)
6. [Hashing](learn/hashing.md)
7. [HMAC and key derivation](learn/hmac-and-key-derivation.md)
8. [Encryption](learn/encryption.md)
9. [Classical ciphers and XOR](learn/classical-ciphers.md)
10. [Compression](learn/compression.md)
11. [Unicode security](learn/unicode-security.md)
12. [Data formats and text processing](learn/data-and-text.md)

## Operation reference

[All operations](reference/README.md)

- **Encoding:** [Decode Text](reference/ops/decode-text.md), [Encode Text](reference/ops/encode-text.md), [From Base](reference/ops/from-base.md), [From Base32](reference/ops/from-base32.md), [From Base45](reference/ops/from-base45.md), [From Base58](reference/ops/from-base58.md), [From Base62](reference/ops/from-base62.md), [From Base64](reference/ops/from-base64.md), [From Base85](reference/ops/from-base85.md), [From Base92](reference/ops/from-base92.md), [From Binary](reference/ops/from-binary.md), [From Charcode](reference/ops/from-charcode.md), [From Decimal](reference/ops/from-decimal.md), [From Hex](reference/ops/from-hex.md), [From Modhex](reference/ops/from-modhex.md), [From Octal](reference/ops/from-octal.md), [From Punycode](reference/ops/from-punycode.md), [HTML Entity Decode](reference/ops/html-entity-decode.md), [HTML Entity Encode](reference/ops/html-entity-encode.md), [IDNA To ASCII](reference/ops/idna-to-ascii.md), [IDNA To Unicode](reference/ops/idna-to-unicode.md), [Quoted-Printable Decode](reference/ops/quoted-printable-decode.md), [Quoted-Printable Encode](reference/ops/quoted-printable-encode.md), [Swap Endianness](reference/ops/swap-endianness.md), [To Base](reference/ops/to-base.md), [To Base32](reference/ops/to-base32.md), [To Base45](reference/ops/to-base45.md), [To Base58](reference/ops/to-base58.md), [To Base62](reference/ops/to-base62.md), [To Base64](reference/ops/to-base64.md), [To Base85](reference/ops/to-base85.md), [To Base92](reference/ops/to-base92.md), [To Binary](reference/ops/to-binary.md), [To Charcode](reference/ops/to-charcode.md), [To Decimal](reference/ops/to-decimal.md), [To Hex](reference/ops/to-hex.md), [To Modhex](reference/ops/to-modhex.md), [To Octal](reference/ops/to-octal.md), [To Punycode](reference/ops/to-punycode.md), [URL Decode](reference/ops/url-decode.md), [URL Encode](reference/ops/url-encode.md)
- **Unicode:** [Analyse Characters](reference/ops/analyse-characters.md), [Count](reference/ops/count.md), [Escape Unicode](reference/ops/escape-unicode.md), [Filter by Property](reference/ops/filter-by-property.md), [From Code Points](reference/ops/from-code-points.md), [Grapheme Split](reference/ops/grapheme-split.md), [Normalize](reference/ops/normalize.md), [Show Bidi Classes](reference/ops/show-bidi-classes.md), [Strip Diacritics](reference/ops/strip-diacritics.md), [To Code Points](reference/ops/to-code-points.md), [Unescape Unicode](reference/ops/unescape-unicode.md), [Unicode Case](reference/ops/unicode-case.md), [UTF-8 Explain](reference/ops/utf8-explain.md)
- **Security:** [Detect Confusables](reference/ops/detect-confusables.md), [Detect Invisible Characters](reference/ops/detect-invisible.md), [Remove Bidi Controls](reference/ops/remove-bidi-controls.md), [Script Mix Check](reference/ops/script-mix-check.md)
- **Hashing:** [Adler-32](reference/ops/adler32.md), [BLAKE2b](reference/ops/blake2b.md), [BLAKE2s](reference/ops/blake2s.md), [CRC-32](reference/ops/crc32.md), [HMAC](reference/ops/hmac.md), [MD5](reference/ops/md5.md), [SHA-1](reference/ops/sha1.md), [SHA-2](reference/ops/sha2.md), [SHA-3](reference/ops/sha3.md), [SHAKE](reference/ops/shake.md)
- **Crypto:** [AES Decrypt](reference/ops/aes-decrypt.md), [AES Encrypt](reference/ops/aes-encrypt.md), [Atbash](reference/ops/atbash.md), [Generate Random Bytes](reference/ops/generate-random-bytes.md), [JWT Decode](reference/ops/jwt-decode.md), [JWT Sign](reference/ops/jwt-sign.md), [JWT Verify](reference/ops/jwt-verify.md), [PBKDF2](reference/ops/pbkdf2.md), [ROT13](reference/ops/rot13.md), [ROT47](reference/ops/rot47.md), [Vigenère Decode](reference/ops/vigenere-decode.md), [Vigenère Encode](reference/ops/vigenere-encode.md), [XOR](reference/ops/xor.md)
- **Compression:** [Gunzip](reference/ops/gunzip.md), [Gzip](reference/ops/gzip.md), [Raw Deflate](reference/ops/raw-deflate.md), [Raw Inflate](reference/ops/raw-inflate.md), [Zlib Deflate](reference/ops/zlib-deflate.md), [Zlib Inflate](reference/ops/zlib-inflate.md)
- **Data:** [CSV to JSON](reference/ops/csv-to-json.md), [JSON Beautify](reference/ops/json-beautify.md), [JSON Minify](reference/ops/json-minify.md), [JSON to CSV](reference/ops/json-to-csv.md), [Parse Query String](reference/ops/parse-query-string.md), [Parse URL](reference/ops/parse-url.md)
- **Text:** [Add line numbers](reference/ops/add-line-numbers.md), [Alternating caps](reference/ops/alternating-caps.md), [Find / replace](reference/ops/find-replace.md), [Get all casings](reference/ops/get-all-casings.md), [Head](reference/ops/head.md), [Join lines](reference/ops/join.md), [Pad lines](reference/ops/pad-lines.md), [Regex extract](reference/ops/regex-extract.md), [Remove ANSI escape codes](reference/ops/remove-ansi-escape-codes.md), [Remove line numbers](reference/ops/remove-line-numbers.md), [Remove null bytes](reference/ops/remove-null-bytes.md), [Reverse](reference/ops/reverse.md), [Sort lines](reference/ops/sort-lines.md), [Split](reference/ops/split.md), [Strip HTML tags](reference/ops/strip-html-tags.md), [Swap case](reference/ops/swap-case.md), [Tail](reference/ops/tail.md), [Trim](reference/ops/trim.md), [Unique lines](reference/ops/unique-lines.md)
- **Flow:** [Comment](reference/ops/comment.md), [Conditional jump](reference/ops/conditional-jump.md), [Fork](reference/ops/fork.md), [Jump](reference/ops/jump.md), [Label](reference/ops/label.md), [Sub-recipe](reference/ops/sub-recipe.md), [Subsection](reference/ops/subsection.md)

## Project

- [Introduction and install](../INTRODUCTION.md)
- [Roadmap](roadmap.md)
- [CyberChef operations and how they map](upstream/cyberchef-operations.md)
- [Brand guide](branding/README.md)
- [Release process](release/process.md)
- [Publishing the extensions](extensions/publishing.md)
- [Contributing](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)
<!-- /docs:toc -->

<!-- docs:nav -->
---

[How UniChef works →](learn/how-unichef-works.md)
<!-- /docs:nav -->
