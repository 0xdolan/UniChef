# UniChef roadmap

UniChef is a **cybersecurity and Unicode workbench**. It encodes, decodes, hashes, encrypts,
compresses and inspects data in a recipe pipeline, the way CyberChef does. It adds the
Unicode depth of a character browser like UniView, and security checks for invisible, bidi and
confusable characters. This file is the plan for getting there. Each workstream has a GitHub
milestone or issue, and each item is done when its tests are green in CI.

## Scope (the request, restated)

1. **Brand in every header.** The web app, GitHub Pages and the extension show the UniChef
   lockup (the mark, plus "Uni" and "Chef" in the logo's own colours and letterforms). It links
   to the home page (the Workbench). Users must always see the current build: a new release
   replaces a cached copy on the next visit, and the app says when it has updated.
2. **Positioning.** UniChef is described everywhere as a cybersecurity *and* Unicode tool,
   not a Unicode-only one: the README, introduction, About page, repository description and
   topics, package metadata (PyPI, npm, Debian), store listings and social copy.
3. **Documentation for every operation.** Each operation has a reference page that covers:
   - what it does and how it works, step by step, with a worked example;
   - its arguments and their defaults;
   - examples, checked by tests;
   - how to run it in the web app, the CLI, Python and TypeScript;
   - security notes, the standards it implements, links for further reading, and related
     operations.

   Concept guides explain the background: Unicode and character encodings, base-N encodings,
   hashing, HMAC and key derivation, encryption, compression, and Unicode attacks. Every page
   has the full table of contents, a breadcrumb, and previous and next links. Each operation
   in the app links to its page, so a curious user can learn how it works without leaving the
   tool. The docs work offline and in the extension.
4. **Marketing and brand assets.** The kit covers:
   - refreshed screenshots of the web app (light and dark, desktop and phone), the extension
     and the CLI;
   - logos and favicons;
   - an Open Graph / social card;
   - store promo tiles;
   - launch copy for social media with hashtags;
   - a first-run introduction tour in the app.

   It follows what current CyberChef and UniView do well, such as CyberChef's per-operation
   "more info" links and UniView's character detail pages.
5. **CyberChef coverage.** Every CyberChef operation gets a milestone or a written reason why
   UniChef will not port it. The plan is below.

## Phases

| Phase | Work | State |
|---|---|---|
| 0 | Credit footer and phone fixes (FR-011, NFR-043) | PR #66 |
| 1 | Brand lockup check in every header; the app reloads into a new release and says so | next |
| 2 | Positioning: README, introduction, About, repo description and topics, package metadata | next |
| 3 | Docs system: `docs/reference/` pages built from `spec/ops.json` plus written explanations, concept guides in `docs/learn/`, in-app `#/docs` reader, a "How it works" link on every recipe step (FR-013, FR-014) | done |
| 4 | Marketing kit: social card, store tiles, launch copy, refreshed screenshots, first-run tour | after 3 |
| 5 | CyberChef parity milestones 1.1 to 2.0 (below) | after 1.0.0 |

### Phase 3 design

- **Source.** One Markdown file per operation in `docs/reference/ops/<id>.md` and one per
  concept in `docs/learn/`. They read well on GitHub as well.
- **Generated parts.** `scripts/docs/build.py` fills in the arguments table, examples, usage
  snippets, breadcrumb, table of contents and previous/next links from `spec/ops.json`,
  between marker comments. `--check` fails CI when an operation has no page or a page is
  stale.
- **In the app.** At build time `clients/web/vite.docs.ts` parses each page with marked (a
  dev dependency) into plain data that React renders, so there is no Markdown parser and no
  raw HTML at runtime, nothing is loaded from other sites, and the CSP is unchanged. Each
  page is its own lazy chunk, precached for offline use. `#/docs` shows the table of
  contents and `#/docs/<path>` one page. Each recipe step's `?` button and the footer's Docs
  link point there; the extension opens the same pages on the Pages site.
- **Requirements.** FR-013: every operation has a page, it is current and its links and
  examples work (`pytest scripts`, `test_docs_links.py`). FR-014: the reader converts every
  page, every reader link resolves and every operation links to its page
  (`clients/web/test/docs.test.tsx`).

## CyberChef parity

CyberChef v11.5.0 has 506 operations, and UniChef 1.0 covers 79 of them. Each new operation
follows the cyberchef-reference skill:
- a PRD §3.8 entry;
- Python and TypeScript implementations;
- shared vectors;
- a docs page;
- an importer mapping;
- attribution where code is ported.

`docs/upstream/cyberchef-operations.md` holds the per-operation milestone.

| Milestone | Theme | Operations |
|---|---|---|
| **1.1** Encoding and text | Base45/62/92, any radix, Bech32, Modhex, BCD, Charcode, Float, Hexdump, Hex Content, Braille, Morse, A1Z26, Bacon, NATO, Leet, COBS, CBOR, MessagePack, YAML↔JSON, Rison, PEM↔Hex, Escape/Unescape string, Smart Characters, Caret/M, MIME decoding, Text-Integer, swap endianness, case conversions (snake, camel, kebab, swap, alternating, all casings), line, byte and padding utilities, Remove null bytes, Remove ANSI codes, Strip HTML tags, diff, Hamming and Levenshtein distance, NetBIOS, Citrix CTX1, ROT8000, Unicode Text Format, Text Encoding Brute Force | about 85 |
| **1.2** Hashing, ciphers and analysis | All remaining hashes and checksums (MD2/4/6, SHA-0, RIPEMD, Whirlpool, BLAKE3, Keccak, SM3, Streebog, GOST, NT/LM, bcrypt, scrypt, Argon2, CMAC, Fletcher, Luhn, MurmurHash3, SSDEEP/CTPH, Analyse hash), classical ciphers (Affine, Bifid, Rail Fence, Substitute, Caesar Box, Cetacean, LS47), symmetric ciphers (DES, 3DES, Blowfish, Twofish, RC2/4/6, ChaCha, Salsa20, XSalsa20, Rabbit, TEA family, SM4, PRESENT, GOST, Ascon, Fernet, CipherSaber2, AES key wrap, HKDF, EVP), brute force (XOR, ROT), arithmetic and logic, statistics (entropy, frequency, index of coincidence, chi-square), UUID, TOTP/HOTP, date and time, unit conversions | about 150 |
| **1.3** Networking, extractors, public key, forensics | Extractors (strings, IPs, emails, URLs, domains, hashes, paths, dates, XPath, JSONPath, CSS selector, jq), network parsers (IPv4/6, TCP, UDP, TLS, Ethernet, User-Agent, VarInt, Protobuf), fingerprints (JA3, JA3S, JA4, HASSH), Defang/Fang, X.509, CSR, CRL, ASN.1, OID, PEM/JWK, RSA, ECDSA, SSH host keys, PGP, SM2, file type detection, embedded files, ELF, EXIF, archives (Zip, Tar, Bzip2, LZMA, LZ4, LZString, LZNT1, XPRESS), code beautify and minify, PHP serialise, BSON, Magic, Register | about 150 |
| **2.0** Media | Image operations, charts, OCR, QR codes, PDF and media rendering, steganography (LSB, bit planes), disassembly. These need an image dish type and large libraries, so they come after the core is stable. | about 40 |
| **Not ported** | HTTP request and DNS over HTTPS (UniChef never makes network requests: SEC-001); CyberChef's internal test op; joke ops (Numberwang, XKCD Random Number); Sleep | 6 |

The enigma-family simulators (Enigma, Bombe, Multiple Bombe, Typex, Lorenz, Colossus,
SIGABA) sit in 2.0, because they need their own visual UI to be useful.
