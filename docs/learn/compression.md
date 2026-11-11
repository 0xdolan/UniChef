<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Compression

Lossless compression makes data smaller by describing repetition instead of repeating it,
and decompression restores every byte. In security work you meet compressed data
everywhere: HTTP responses, PDF streams, PNG images, Git objects, Java archives, memory
dumps, and malware payloads that are compressed then Base64-encoded to slip past filters.

## DEFLATE

**DEFLATE** (RFC 1951) is the algorithm inside gzip, zlib, Zip and PNG. It combines two ideas:

1. **LZ77: back-references.** The encoder keeps the last 32 KiB of input as a window. When the
   upcoming bytes already occurred in the window, it writes a pair *(length, distance)*
   instead of the bytes: "copy 6 bytes from 12 bytes back". In `abcabcabcabc`, everything
   after the first `abc` becomes one reference: copy 9 bytes from 3 back (copies may overlap
   themselves, which encodes runs).
2. **Huffman coding: short codes for common symbols.** The literals and lengths are coded with
   variable-length bit codes, so frequent symbols use fewer bits. A block uses either fixed
   codes defined by the standard or dynamic codes described at the start of the block.

The **level** (0 to 9) is how hard the encoder searches for matches: 1 is fastest, 9 is
smallest, and 0 just stores the data in uncompressed blocks. Every level produces data
that any inflater can read.

## Three wrappers around DEFLATE

The same compressed stream comes in three containers. Mixing them up is the most common
reason decompression fails.

| Format | Starts with | Around the DEFLATE data | Checksum | Used by |
|---|---|---|---|---|
| raw DEFLATE | nothing in particular | nothing | none | Zip entries, PDF `/FlateDecode` in some tools, WebSocket compression |
| zlib (RFC 1950) | `78 01`, `78 5e`, `78 9c` or `78 da` | a 2-byte header | Adler-32 of the data | PNG, PDF streams, Git objects, HTTP `deflate` |
| gzip (RFC 1952) | `1f 8b 08` | a 10-byte header (flags, time, OS), optional file name | CRC-32 and length | `.gz` files, HTTP `gzip` |

**Worked example.** Level 0 stores `Hi` uncompressed, so you can read the structure byte by
byte. [Raw Deflate](../reference/ops/raw-deflate.md) gives `01 02 00 fd ff 48 69`:
- `01` is a block header: final block, stored;
- `02 00` is the length 2 (little-endian), and `fd ff` is its one's complement;
- `48 69` is `Hi`.

[Zlib Deflate](../reference/ops/zlib-deflate.md) adds the header `78 01` in front and the
Adler-32 `00 fb 00 b2` behind. [Gzip](../reference/ops/gzip.md) adds the header
`1f 8b 08 00 00 00 00 00 00 ff` in front and the CRC-32 and length behind.

**Spotting it.** `78 9c` (default level) and `78 da` (best) open zlib data; `H4sI` is how
`1f 8b 08` looks in Base64, so `H4sI…` is a Base64-encoded gzip, and `eJ` opens Base64 zlib.
A recipe of [From Base64](../reference/ops/from-base64.md) then
[Gunzip](../reference/ops/gunzip.md) unpacks the typical obfuscated PowerShell or web shell
payload.

## Security notes

- **Decompression bombs.** A few kilobytes of DEFLATE can expand to gigabytes (the ratio
  reaches about 1032:1, and nested archives go further). UniChef limits the output size of
  every step.
- **Compression leaks length.** Compressing secret data together with attacker-controlled data
  and then encrypting it reveals, through the ciphertext length, whether the attacker's guess
  matched the secret. The CRIME and BREACH attacks recovered cookies and CSRF tokens this way.
- **Integrity.** zlib and gzip checksums detect corruption, not tampering: anyone can
  recompute them.

<!-- docs:ops -->
Operations explained here: [Gunzip](../reference/ops/gunzip.md), [Gzip](../reference/ops/gzip.md), [Raw Deflate](../reference/ops/raw-deflate.md), [Raw Inflate](../reference/ops/raw-inflate.md), [Zlib Deflate](../reference/ops/zlib-deflate.md), [Zlib Inflate](../reference/ops/zlib-inflate.md).
<!-- /docs:ops -->

## Learn more

- [RFC 1951: DEFLATE](https://www.rfc-editor.org/rfc/rfc1951)
- [RFC 1950: zlib](https://www.rfc-editor.org/rfc/rfc1950)
- [RFC 1952: gzip](https://www.rfc-editor.org/rfc/rfc1952)
- [An explanation of the DEFLATE algorithm, by Antaeus Feldspar](https://zlib.net/feldspar.html)
- [BREACH attack](https://www.breachattack.com/)

<!-- docs:nav -->
---

[← Classical ciphers and XOR](classical-ciphers.md) · [Contents](../README.md) · [Unicode security →](unicode-security.md)
<!-- /docs:nav -->
