# Changelog

All notable changes to UniChef are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Release entries are generated from Conventional Commits by `make version`.

## [Unreleased]

### Added

- **Python core** (`packages/python-cli`):
  - Dish types and coercions, an in-house UTF-8 codec, the op registry, recipe loading and the runner.
  - The Unicode engine, built on the pinned UCD:
    - properties and names;
    - NFC/NFD/NFKC/NFKD normalization;
    - grapheme segmentation;
    - full and tailored case mapping;
    - UTS #39 skeletons and restriction levels.
  - The portable regex profile, with a translator and a runner that has timeouts.
  - The character query language.
- **Operations:**
  - Encoding: base64, base32, hex, URL, text encodings, binary, octal, decimal and HTML entities.
  - Text: the text operations.
  - Flow: the flow operations, including `subsection` and `conditional-jump`.
  - Unicode: escapes, normalize, case, diacritics, graphemes, code points, `count` and `analyse-characters`.
  - Security: `detect-invisible`, `remove-bidi-controls`, `detect-confusables` and `script-mix-check`.
  - Hashing: MD5, SHA-1, SHA-2, SHA-3, SHAKE, BLAKE2b, BLAKE2s, CRC-32, Adler-32 and HMAC.
  - Crypto: XOR, ROT13, ROT47, Atbash and AES (CBC, CTR, GCM, ECB).
- **Spec:** shared vectors for every operation, with published known answers for hashing and AES.
- **Build:** the WHATWG HTML entity table pipeline (`scripts/html/build.py`), with SHA-256 lock verification.
- **Developer tooling:** the `ui-ux-pro-max` and `shadcn` agent skills, vendored for the responsive web UI work. They are not shipped.
- Logo masters, brand guide and the master generator script.
- UCD pipeline: `scripts/ucd/fetch.py` and `build.py`, the Unicode 18.0.0 source files and the three compiled data files.
- Shared spec: recipe, output and vector schemas, the error catalogue, and vectors for ten encoding ops.
- Repository scaffold: project constants, `VERSION`, licence and notices, and the Makefile skeleton.
