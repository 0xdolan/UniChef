# CyberChef Operation Inventory and UniChef Mapping

> Generated from `src/core/config/Categories.json` at CyberChef commit `d4d96c6c3d2597fef836d81bfc04617d97c681a5` (v11.5.0, 2026-11-04).
> Mapping targets are the op ids in [UniChef-PRD.md §3.8](../../UniChef-PRD.md). Seed `spec/cyberchef-map.json` from this table.

**Totals:** 506 unique operations (some appear in several categories); 148 have a UniChef equivalent (79 in 1.0); 358 are not yet covered.

Rules for the importer:

- "not planned" ops abort import with `E_OP_UNKNOWN` listing every such op (FR-009).
- CyberChef args are **positional** and often carry display strings (for example the Base64 alphabet `"A-Za-z0-9+/="`). Each mapping entry must translate positional values into UniChef named args, and reject values it cannot translate.
- `Fork` and `Subsection` are **linear** in CyberChef: they apply to every following op until `Merge` (or end of recipe). UniChef nests steps, so the importer folds the ops between `Fork`/`Subsection` and the next `Merge` into the `steps` arg.

## Data format (80)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| To Hexdump | `to-hexdump` | 1.1 |
| From Hexdump | `from-hexdump` | 1.1 |
| To Hex | `to-hex` | Alpha |
| From Hex | `from-hex` | Alpha |
| To Charcode | `to-charcode` | 1.1 |
| From Charcode | `from-charcode` | 1.1 |
| To Decimal | `to-decimal` | Alpha |
| From Decimal | `from-decimal` | Alpha |
| To Float | `to-float` | 1.1 |
| From Float | `from-float` | 1.1 |
| To Binary | `to-binary` | Alpha |
| From Binary | `from-binary` | Alpha |
| To Octal | `to-octal` | Alpha |
| From Octal | `from-octal` | Alpha |
| To Base32 | `to-base32` | Alpha |
| From Base32 | `from-base32` | Alpha |
| To Base45 | `to-base45` | 1.1 |
| From Base45 | `from-base45` | 1.1 |
| To Base58 | `to-base58` | Beta |
| From Base58 | `from-base58` | Beta |
| To Bech32 | `to-bech32` | 1.1 |
| From Bech32 | `from-bech32` | 1.1 |
| To Base62 | `to-base62` | 1.1 |
| From Base62 | `from-base62` | 1.1 |
| To Base64 | `to-base64` | Alpha |
| From Base64 | `from-base64` | Alpha |
| Show Base64 offsets | not planned | — |
| To Base92 | `to-base92` | 1.1 |
| From Base92 | `from-base92` | 1.1 |
| To Base85 | `to-base85` | Beta |
| From Base85 | `from-base85` | Beta |
| To Base | `to-base` | 1.1 |
| From Base | `from-base` | 1.1 |
| To BCD | `to-bcd` | 1.1 |
| From BCD | `from-bcd` | 1.1 |
| Text-Integer Conversion | `text-integer` | 1.1 |
| To HTML Entity | `html-entity-encode` | Alpha |
| From HTML Entity | `html-entity-decode` | Alpha |
| URL Encode | `url-encode` | Alpha |
| URL Decode | `url-decode` | Alpha |
| Escape Unicode Characters | `escape-unicode` | Alpha |
| Unescape Unicode Characters | `unescape-unicode` | Alpha |
| Normalise Unicode | `normalize` | Alpha |
| Escape Smart Characters | `escape-smart-characters` | 1.1 |
| To Quoted Printable | `quoted-printable-encode` | Beta |
| From Quoted Printable | `quoted-printable-decode` | Beta |
| To Punycode | `to-punycode` | Beta |
| From Punycode | `from-punycode` | Beta |
| AMF Encode | not planned | — |
| AMF Decode | not planned | — |
| To Hex Content | `to-hex-content` | 1.1 |
| From Hex Content | `from-hex-content` | 1.1 |
| PEM to Hex | `pem-to-hex` | 1.1 |
| Hex to PEM | `hex-to-pem` | 1.1 |
| Parse ASN.1 hex string | not planned | — |
| Change IP format | not planned | — |
| Encode text | `encode-text` | Alpha |
| Decode text | `decode-text` | Alpha |
| Text Encoding Brute Force | not planned | — |
| Swap endianness | `swap-endianness` | 1.1 |
| To MessagePack | not planned | — |
| From MessagePack | not planned | — |
| To Braille | `to-braille` | 1.1 |
| From Braille | `from-braille` | 1.1 |
| Parse TLV | not planned | — |
| CSV to JSON | `csv-to-json` | Beta |
| JSON to CSV | `json-to-csv` | Beta |
| Avro to JSON | not planned | — |
| CBOR Encode | not planned | — |
| CBOR Decode | not planned | — |
| YAML to JSON | not planned | — |
| JSON to YAML | not planned | — |
| Caret/M-decode | `caret-m-decode` | 1.1 |
| Rison Encode | `to-rison` | 1.1 |
| Rison Decode | `from-rison` | 1.1 |
| To Modhex | `to-modhex` | 1.1 |
| From Modhex | `from-modhex` | 1.1 |
| MIME Decoding | not planned | — |
| To COBS | not planned | — |
| From COBS | not planned | — |

## Encryption / Encoding (95)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| AES Encrypt | `aes-encrypt` | Alpha |
| AES Decrypt | `aes-decrypt` | Alpha |
| Blowfish Encrypt | not planned | — |
| Blowfish Decrypt | not planned | — |
| DES Encrypt | not planned | — |
| DES Decrypt | not planned | — |
| Triple DES Encrypt | not planned | — |
| Triple DES Decrypt | not planned | — |
| Fernet Encrypt | not planned | — |
| Fernet Decrypt | not planned | — |
| LS47 Encrypt | not planned | — |
| LS47 Decrypt | not planned | — |
| RC2 Encrypt | not planned | — |
| RC2 Decrypt | not planned | — |
| RC4 | not planned | — |
| RC4 Drop | not planned | — |
| ChaCha | not planned | — |
| Salsa20 | not planned | — |
| XSalsa20 | not planned | — |
| Rabbit | not planned | — |
| SM4 Encrypt | not planned | — |
| SM4 Decrypt | not planned | — |
| RC6 Encrypt | not planned | — |
| RC6 Decrypt | not planned | — |
| Ascon Encrypt | not planned | — |
| Ascon Decrypt | not planned | — |
| PRESENT Encrypt | not planned | — |
| PRESENT Decrypt | not planned | — |
| Twofish Encrypt | not planned | — |
| Twofish Decrypt | not planned | — |
| GOST Encrypt | not planned | — |
| GOST Decrypt | not planned | — |
| GOST Sign | not planned | — |
| GOST Verify | not planned | — |
| GOST Key Wrap | not planned | — |
| GOST Key Unwrap | not planned | — |
| ROR13 | not planned | — |
| ROT13 | `rot13` | Alpha |
| ROT13 Brute Force | not planned | — |
| ROT47 | `rot47` | Alpha |
| ROT47 Brute Force | not planned | — |
| ROT8000 | `rot8000` | 1.1 |
| XOR | `xor` | Alpha |
| XOR Brute Force | not planned | — |
| Vigenère Encode | `vigenere-encode` | Beta |
| Vigenère Decode | `vigenere-decode` | Beta |
| TEA Encrypt | not planned | — |
| TEA Decrypt | not planned | — |
| XTEA Encrypt | not planned | — |
| XTEA Decrypt | not planned | — |
| XXTEA Encrypt | not planned | — |
| XXTEA Decrypt | not planned | — |
| To Morse Code | `to-morse-code` | 1.1 |
| From Morse Code | `from-morse-code` | 1.1 |
| Bacon Cipher Encode | `bacon-encode` | 1.1 |
| Bacon Cipher Decode | `bacon-decode` | 1.1 |
| Bifid Cipher Encode | not planned | — |
| Bifid Cipher Decode | not planned | — |
| Caesar Box Cipher | not planned | — |
| Affine Cipher Encode | not planned | — |
| Affine Cipher Decode | not planned | — |
| A1Z26 Cipher Encode | `a1z26-encode` | 1.1 |
| A1Z26 Cipher Decode | `a1z26-decode` | 1.1 |
| Rail Fence Cipher Encode | not planned | — |
| Rail Fence Cipher Decode | not planned | — |
| Atbash Cipher | `atbash` | Alpha |
| CipherSaber2 Encrypt | not planned | — |
| CipherSaber2 Decrypt | not planned | — |
| Cetacean Cipher Encode | not planned | — |
| Cetacean Cipher Decode | not planned | — |
| Substitute | not planned | — |
| Derive PBKDF2 key | `pbkdf2` (not importable: CyberChef takes the passphrase as an argument, UniChef as the input) | Beta |
| Derive EVP key | not planned | — |
| Derive HKDF key | not planned | — |
| Bcrypt | not planned | — |
| Scrypt | not planned | — |
| JWT Sign | `jwt-sign` | Beta |
| JWT Verify | `jwt-verify` (not importable: CyberChef accepts whatever algorithm the token names, UniChef requires a fixed one) | Beta |
| JWT Decode | `jwt-decode` | Beta |
| Citrix CTX1 Encode | `citrix-ctx1-encode` | 1.1 |
| Citrix CTX1 Decode | `citrix-ctx1-decode` | 1.1 |
| AES Key Wrap | not planned | — |
| AES Key Unwrap | not planned | — |
| Pseudo-Random Number Generator | `generate-random-bytes` | Beta |
| Pseudo-Random Prime Generator | not planned | — |
| Enigma | not planned | — |
| Bombe | not planned | — |
| Multiple Bombe | not planned | — |
| Typex | not planned | — |
| Lorenz | not planned | — |
| Colossus | not planned | — |
| SIGABA | not planned | — |
| Flask Session Decode | not planned | — |
| Flask Session Sign | not planned | — |
| Flask Session Verify | not planned | — |

## Public Key (33)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Parse X.509 certificate | not planned | — |
| Parse X.509 certificate bundles | not planned | — |
| Parse X.509 CRL | not planned | — |
| Parse ASN.1 hex string | not planned | — |
| PEM to Hex | `pem-to-hex` | 1.1 |
| Hex to PEM | `hex-to-pem` | 1.1 |
| Hex to Object Identifier | not planned | — |
| Object Identifier to Hex | not planned | — |
| PEM to JWK | not planned | — |
| JWK to PEM | not planned | — |
| Generate PGP Key Pair | not planned | — |
| PGP Encrypt | not planned | — |
| PGP Decrypt | not planned | — |
| PGP Sign | not planned | — |
| PGP Verify | not planned | — |
| PGP Encrypt and Sign | not planned | — |
| PGP Decrypt and Verify | not planned | — |
| Parse PGP Key | not planned | — |
| Generate RSA Key Pair | not planned | — |
| RSA Sign | not planned | — |
| RSA Verify | not planned | — |
| RSA Encrypt | not planned | — |
| RSA Decrypt | not planned | — |
| Generate ECDSA Key Pair | not planned | — |
| ECDSA Signature Conversion | not planned | — |
| ECDSA Sign | not planned | — |
| ECDSA Verify | not planned | — |
| Parse SSH Host Key | not planned | — |
| Parse CSR | not planned | — |
| Public Key from Certificate | not planned | — |
| Public Key from Private Key | not planned | — |
| SM2 Encrypt | not planned | — |
| SM2 Decrypt | not planned | — |

## Arithmetic / Logic (31)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Set Union | `set-union` | 1.1 |
| Set Intersection | `set-intersection` | 1.1 |
| Set Difference | `set-difference` | 1.1 |
| Symmetric Difference | `symmetric-difference` | 1.1 |
| Cartesian Product | `cartesian-product` | 1.1 |
| Power Set | `power-set` | 1.1 |
| XOR | `xor` | Alpha |
| XOR Brute Force | not planned | — |
| OR | not planned | — |
| NOT | not planned | — |
| AND | not planned | — |
| ADD | not planned | — |
| SUB | not planned | — |
| Sum | not planned | — |
| Subtract | not planned | — |
| Multiply | not planned | — |
| Divide | not planned | — |
| MOD | not planned | — |
| Extended GCD | not planned | — |
| Modular Exponentiation | not planned | — |
| Modular Inverse | not planned | — |
| Mean | not planned | — |
| Median | not planned | — |
| Standard Deviation | not planned | — |
| Bit shift left | not planned | — |
| Bit shift right | not planned | — |
| Rotate left | not planned | — |
| Rotate right | not planned | — |
| ROR13 | not planned | — |
| ROT13 | `rot13` | Alpha |
| ROT8000 | `rot8000` | 1.1 |

## Networking (38)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| HTTP request | not planned | never: SEC-001, UniChef makes no network requests |
| DNS over HTTPS | not planned | never: SEC-001, UniChef makes no network requests |
| Strip HTTP headers | not planned | — |
| Dechunk HTTP response | not planned | — |
| Parse Ethernet frame | not planned | — |
| Parse User Agent | not planned | — |
| Parse IP range | not planned | — |
| Parse IPv6 address | not planned | — |
| IPv6 Transition Addresses | not planned | — |
| Parse IPv4 header | not planned | — |
| Strip IPv4 header | not planned | — |
| Parse TCP | not planned | — |
| Strip TCP header | not planned | — |
| Parse TLS record | not planned | — |
| Parse UDP | not planned | — |
| Strip UDP header | not planned | — |
| Parse SSH Host Key | not planned | — |
| Parse URI | `parse-url` (not importable: CyberChef writes a text table, UniChef returns JSON parts) | Beta |
| URL Encode | `url-encode` | Alpha |
| URL Decode | `url-decode` | Alpha |
| Protobuf Decode | not planned | — |
| Protobuf Encode | not planned | — |
| VarInt Encode | not planned | — |
| VarInt Decode | not planned | — |
| JA3 Fingerprint | not planned | — |
| JA3S Fingerprint | not planned | — |
| JA4 Fingerprint | not planned | — |
| JA4Server Fingerprint | not planned | — |
| HASSH Client Fingerprint | not planned | — |
| HASSH Server Fingerprint | not planned | — |
| Format MAC addresses | not planned | — |
| Change IP format | not planned | — |
| Group IP addresses | not planned | — |
| Encode NetBIOS Name | `encode-netbios-name` | 1.1 |
| Decode NetBIOS Name | `decode-netbios-name` | 1.1 |
| Defang URL | not planned | — |
| Fang URL | not planned | — |
| Defang IP Addresses | not planned | — |

## Language (7)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Encode text | `encode-text` | Alpha |
| Decode text | `decode-text` | Alpha |
| Unicode Text Format | `unicode-text-format` | 1.1 |
| Remove Diacritics | `strip-diacritics` | Alpha |
| Unescape Unicode Characters | `unescape-unicode` | Alpha |
| Convert to NATO alphabet | `to-nato-alphabet` | 1.1 |
| Convert Leet Speak | `leet-speak` | 1.1 |

## Utils (52)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Diff | not planned | — |
| Remove whitespace | `trim` (not importable: CyberChef removes whitespace everywhere, `trim` only at the ends) | Alpha |
| Remove null bytes | `remove-null-bytes` | 1.1 |
| Remove ANSI Escape Codes | `remove-ansi-escape-codes` | 1.1 |
| To Upper case | `unicode-case (upper)` | Alpha |
| To Lower case | `unicode-case (lower)` | Alpha |
| Swap case | `swap-case` | 1.1 |
| Alternating Caps | `alternating-caps` | 1.1 |
| To Case Insensitive Regex | not planned | — |
| From Case Insensitive Regex | not planned | — |
| Add line numbers | `add-line-numbers` | 1.1 |
| Remove line numbers | `remove-line-numbers` | 1.1 |
| Get All Casings | `get-all-casings` | 1.1 |
| To Table | not planned | — |
| Reverse | `reverse` | Alpha |
| Sort | `sort-lines` | Alpha |
| Shuffle | not planned | — |
| Unique | `unique-lines` | Alpha |
| Split | `split` | Alpha |
| Filter | not planned | — |
| Head | `head` | Alpha |
| Tail | `tail` | Alpha |
| Count occurrences | not planned | — |
| Expand alphabet range | not planned | — |
| Drop bytes | not planned | — |
| Take bytes | not planned | — |
| Pad lines | `pad-lines` | 1.1 |
| Find / Replace | `find-replace` | Alpha |
| Regular expression | `regex-extract` | Alpha |
| Fuzzy Match | not planned | — |
| Offset checker | not planned | — |
| Hamming Distance | `hamming-distance` | 1.1 |
| Levenshtein Distance | `levenshtein-distance` | 1.1 |
| Convert distance | not planned | — |
| Convert area | not planned | — |
| Convert mass | not planned | — |
| Convert speed | not planned | — |
| Convert data units | not planned | — |
| Convert co-ordinate format | not planned | — |
| Show on map | not planned | — |
| Parse UNIX file permissions | not planned | — |
| Parse ObjectID timestamp | not planned | — |
| Swap endianness | `swap-endianness` | 1.1 |
| Parse colour code | not planned | — |
| Escape string | `escape-string` | 1.1 |
| Unescape string | `unescape-string` | 1.1 |
| Pseudo-Random Number Generator | `generate-random-bytes` | Beta |
| Sleep | not planned | never: only useful for testing CyberChef itself |
| File Tree | not planned | — |
| Wrap | `wrap` | 1.1 |
| Take nth bytes | not planned | — |
| Drop nth bytes | not planned | — |

## Date / Time (10)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Parse DateTime | not planned | — |
| Translate DateTime Format | not planned | — |
| From UNIX Timestamp | not planned | — |
| To UNIX Timestamp | not planned | — |
| Windows Filetime to UNIX Timestamp | not planned | — |
| UNIX Timestamp to Windows Filetime | not planned | — |
| DateTime Delta | not planned | — |
| Extract dates | not planned | — |
| Get Time | not planned | — |
| Sleep | not planned | never: only useful for testing CyberChef itself |

## Extractors (20)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Strings | not planned | — |
| Extract IP addresses | not planned | — |
| Extract email addresses | not planned | — |
| Extract MAC addresses | not planned | — |
| Extract URLs | not planned | — |
| Extract domains | not planned | — |
| Extract file paths | not planned | — |
| Extract dates | not planned | — |
| Extract hashes | not planned | — |
| Regular expression | `regex-extract` | Alpha |
| XPath expression | not planned | — |
| JPath expression | not planned | — |
| Jsonata Query | not planned | — |
| CSS selector | not planned | — |
| Extract EXIF | not planned | — |
| Extract ID3 | not planned | — |
| Extract Audio Metadata | not planned | — |
| Extract Files | not planned | — |
| RAKE | not planned | — |
| Template | not planned | — |

## Compression (21)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Raw Deflate | `raw-deflate` | Beta |
| Raw Inflate | `raw-inflate` | Beta |
| Zlib Deflate | `zlib-deflate` | Beta |
| Zlib Inflate | `zlib-inflate` | Beta |
| Gzip | `gzip` | Beta |
| Gunzip | `gunzip` | Beta |
| Zip | not planned | — |
| Unzip | not planned | — |
| Bzip2 Decompress | not planned | — |
| Bzip2 Compress | not planned | — |
| Tar | not planned | — |
| Untar | not planned | — |
| LZString Decompress | not planned | — |
| LZString Compress | not planned | — |
| LZMA Decompress | not planned | — |
| LZMA Compress | not planned | — |
| LZ4 Decompress | not planned | — |
| LZ4 Compress | not planned | — |
| LZNT1 Decompress | not planned | — |
| XPRESS Decompress | not planned | — |
| XPRESS LZ77+Huffman Decompress | not planned | — |

## Hashing (50)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Analyse hash | not planned | — |
| Generate all checksums | not planned | — |
| Generate all hashes | not planned | — |
| MD2 | not planned | — |
| MD4 | not planned | — |
| MD5 | `md5` | Alpha |
| MD6 | not planned | — |
| SHA0 | not planned | — |
| SHA1 | `sha1` | Alpha |
| SHA2 | `sha2` | Alpha |
| SHA3 | `sha3` | Alpha |
| SM3 | not planned | — |
| Keccak | not planned | — |
| Shake | `shake` | Alpha |
| RIPEMD | not planned | — |
| HAS-160 | not planned | — |
| Whirlpool | not planned | — |
| Snefru | not planned | — |
| BLAKE2b | `blake2b` | Alpha |
| BLAKE2s | `blake2s` | Alpha |
| BLAKE3 | not planned | — |
| Ascon Hash | not planned | — |
| Ascon MAC | not planned | — |
| GOST Hash | not planned | — |
| Streebog | not planned | — |
| SSDEEP | not planned | — |
| CTPH | not planned | — |
| Compare SSDEEP hashes | not planned | — |
| Compare CTPH hashes | not planned | — |
| HMAC | `hmac` | Alpha |
| CMAC | not planned | — |
| Bcrypt | not planned | — |
| Bcrypt compare | not planned | — |
| Bcrypt parse | not planned | — |
| Argon2 | not planned | — |
| Argon2 compare | not planned | — |
| Scrypt | not planned | — |
| NT Hash | not planned | — |
| LM Hash | not planned | — |
| MurmurHash3 | not planned | — |
| Fletcher-8 Checksum | not planned | — |
| Fletcher-16 Checksum | not planned | — |
| Fletcher-32 Checksum | not planned | — |
| Fletcher-64 Checksum | not planned | — |
| Adler-32 Checksum | `adler32` | Alpha |
| Luhn Checksum | not planned | — |
| CRC Checksum | `crc32` (the CRC-32 algorithm only; the importer also accepts the older `CRC-32 Checksum` name) | Alpha |
| TCP/IP Checksum | not planned | — |
| XOR Checksum | not planned | — |
| Parity Bit | not planned | — |

## Code tidy (30)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Syntax highlighter | not planned | — |
| Generic Code Beautify | not planned | — |
| JavaScript Parser | not planned | — |
| JavaScript Beautify | not planned | — |
| JavaScript Minify | not planned | — |
| JSON Beautify | `json-beautify` | Beta |
| JSON Minify | `json-minify` | Beta |
| XML Beautify | not planned | — |
| XML Minify | not planned | — |
| SQL Beautify | not planned | — |
| SQL Minify | not planned | — |
| CSS Beautify | not planned | — |
| CSS Minify | not planned | — |
| XPath expression | not planned | — |
| JPath expression | not planned | — |
| Jq | not planned | — |
| CSS selector | not planned | — |
| PHP Deserialize | not planned | — |
| PHP Serialize | not planned | — |
| Microsoft Script Decoder | not planned | — |
| Strip HTML tags | `strip-html-tags` | 1.1 |
| Diff | not planned | — |
| To Snake case | `to-snake-case` | 1.1 |
| To Camel case | `to-camel-case` | 1.1 |
| To Kebab case | `to-kebab-case` | 1.1 |
| BSON serialise | not planned | — |
| BSON deserialise | not planned | — |
| To MessagePack | not planned | — |
| From MessagePack | not planned | — |
| Render Markdown | not planned | — |

## Forensics (12)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Detect File Type | not planned | — |
| Scan for Embedded Files | not planned | — |
| Extract Files | not planned | — |
| YARA Rules | not planned | — |
| Remove EXIF | not planned | — |
| Extract EXIF | not planned | — |
| Extract RGBA | not planned | — |
| View Bit Plane | not planned | — |
| Randomize Colour Palette | not planned | — |
| Extract LSB | not planned | — |
| ELF Info | not planned | — |
| Extract Audio Metadata | not planned | — |

## Multimedia (29)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Render Image | not planned | — |
| Play Media | not planned | — |
| Generate Image | not planned | — |
| Optical Character Recognition | not planned | — |
| Remove EXIF | not planned | — |
| Extract EXIF | not planned | — |
| Split Colour Channels | not planned | — |
| Rotate Image | not planned | — |
| Resize Image | not planned | — |
| Blur Image | not planned | — |
| Dither Image | not planned | — |
| Invert Image | not planned | — |
| Flip Image | not planned | — |
| Crop Image | not planned | — |
| Image Brightness / Contrast | not planned | — |
| Image Opacity | not planned | — |
| Image Filter | not planned | — |
| Contain Image | not planned | — |
| Cover Image | not planned | — |
| Image Hue/Saturation/Lightness | not planned | — |
| Sharpen Image | not planned | — |
| Normalise Image | not planned | — |
| Convert Image Format | not planned | — |
| Add Text To Image | not planned | — |
| Hex Density chart | not planned | — |
| Scatter chart | not planned | — |
| Series chart | not planned | — |
| Heatmap chart | not planned | — |
| Render PDF | not planned | — |

## Other (22)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Entropy | not planned | — |
| Frequency distribution | not planned | — |
| Index of Coincidence | not planned | — |
| Chi Square | not planned | — |
| P-list Viewer | not planned | — |
| Disassemble x86 | not planned | — |
| Disassemble ARM | not planned | — |
| Pseudo-Random Number Generator | `generate-random-bytes` | Beta |
| Pseudo-Random Integer Generator | not planned | — |
| Generate De Bruijn Sequence | not planned | — |
| Generate UUID | not planned | — |
| Analyse UUID | not planned | — |
| Generate TOTP | not planned | — |
| Generate HOTP | not planned | — |
| Generate QR Code | not planned | — |
| Parse QR Code | not planned | — |
| Haversine distance | not planned | — |
| HTML To Text | not planned | — |
| Generate Lorem Ipsum | not planned | — |
| Numberwang | not planned | never: joke op, no real use |
| XKCD Random Number | not planned | never: joke op, no real use |
| Automated Validation Test Op | not planned | never: CyberChef's internal test |

## Flow control (10)

| CyberChef op | UniChef op id | Milestone |
|---|---|---|
| Magic | not planned | — |
| Fork | `fork (nested; importer must fold Fork…Merge)` | Alpha |
| Subsection | `subsection (nested; importer must fold …Merge)` | Alpha |
| Merge | `— (structural: closes Fork/Subsection on import)` | Alpha |
| Register | not planned | — |
| Label | `label` | Alpha |
| Jump | `jump` | Alpha |
| Conditional Jump | `conditional-jump` | Alpha |
| Return | not planned | — |
| Comment | `comment` | Alpha |
