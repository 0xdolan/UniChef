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
  - JWT: `jwt-decode`, `jwt-sign` and `jwt-verify` with the HS, RS, PS, ES and EdDSA algorithms.
- **Python CLI** (`unichef`, `python -m unichef`):
  - The full command tree, help tree and themed output with the exact palette.
  - JSON output that follows the output envelope schema.
  - The documented exit codes.
  - CyberChef recipe import for about 60 operations (`spec/cyberchef-map.json`).
  - Shell completion and a man page.
- **TypeScript core** (`packages/npm-core`, `@unichef/core`):
  - A port of the Python core with the same dish types, Unicode engine, regex profile and every operation.
  - It passes every shared vector.
  - The gzipped data files load lazily in Node and browsers, and hosts can supply their own source with `setDataSource()`.
- **CI** (`.github/`):
  - Lint, typecheck, Python and TypeScript test matrices.
  - A parity job that checks both cores ran every vector case (`scripts/parity-report.py`).
  - UCD and HTML data drift checks, package builds, CodeQL, Dependabot and CODEOWNERS.
- **Release tooling:**
  - `make version V=…` (`scripts/version/sync.py`) sets the version in every file that carries it, mapping SemVer to the PEP 440, npm, Debian and extension forms, and moves the [Unreleased] changelog entries under the new version.
  - `scripts/version/check.py` and the `version-consistency` CI job fail on any mismatch.
  - `spec/ops.json`, the operation metadata index, generated from the Python registry (`make ops`). A drift check runs in CI and the npm-core tests compare their registry with it.
  - `scripts/check-traceability.py` fails when a PRD requirement ID has no test or CI step. IDs for work not built yet are listed in `scripts/traceability-pending.txt`.
- **Local CI** (`docker/`): `make docker-ci` runs `make ci` in an Ubuntu 24.04 dev container (`Dev.Dockerfile`, `docker-compose.yml`) with the container's own uv and pnpm environments. `make ci` skips stages that are not built yet. A `docker` CI job builds the image on amd64 and arm64.
- **Spec:** shared vectors for every operation, with published known answers for hashing and AES.
- **Build:** the WHATWG HTML entity table pipeline (`scripts/html/build.py`), with SHA-256 lock verification.
- **Developer tooling:** the `ui-ux-pro-max` and `shadcn` agent skills, vendored for the responsive web UI work. They are not shipped.
- Logo masters, brand guide and the master generator script.
- UCD pipeline: `scripts/ucd/fetch.py` and `build.py`, the Unicode 18.0.0 source files and the three compiled data files.
- Shared spec: recipe, output and vector schemas, the error catalogue, and vectors for ten encoding ops.
- Repository scaffold: project constants, `VERSION`, licence and notices, and the Makefile skeleton.
