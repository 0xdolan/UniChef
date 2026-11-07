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
  - Every operation has examples (77 in all) in both cores and in `spec/ops.json`. Tests in each core run them and check the stated output.
- **Python CLI** (`unichef`, `python -m unichef`):
  - The full command tree, help tree and themed output with the exact palette.
  - JSON output that follows the output envelope schema.
  - The documented exit codes.
  - CyberChef recipe import for about 60 operations (`spec/cyberchef-map.json`).
  - Shell completion and a man page.
- **TypeScript core** (`packages/npm-core`, `@unichef/core`):
  - A port of the Python core with the same dish types, Unicode engine, regex profile and every operation.
  - It passes every shared vector.
  - The gzipped data files load lazily in Node and browsers, and hosts can supply their own source with `setDataSource()`. A source may return the files already decompressed, as browsers do when a server sends `Content-Encoding: gzip`.
  - `bake()` takes an `onStep` hook that reports each executed step's path, dish and time.
  - Queries run `name~/…/` terms after the rest of their `&` chain, so `name~/ARROW$/ & gc=Sm & age<=6.0` scans the math symbols' names only (about 400 ms to 6 ms in a browser). Results are unchanged.
- **Web app** (`clients/web`), first slice:
  - The Workbench (`#/`): a searchable operation list, a recipe with schema-driven argument forms for every argument kind (nested steps included), and input and output panes.
  - Input as text, hex or Base64.
  - Every bake runs in a Web Worker. Auto-bake is debounced by 300 ms, and a new bake cancels the previous one. A watchdog restarts a worker that overruns its budget or ignores a cancel.
  - Offline: the UCD and entity data ship as hashed build assets. A strict CSP is set on the production build.
  - Dark and light themes from the PRD palette, an ARIA live bake status, and reduced motion support.
- **Web app**, second slice:
  - The step inspector: each step shows a live badge with its output type, size and time. Selecting a step shows the first 4 KiB of its output as text, a hex dump or a table, with an option to compare it with the step's input. The failing step is outlined with its error, and the steps after it are marked as not run.
  - Steps reorder by drag and drop with a mouse, touch or the keyboard, with screen reader announcements.
  - The recipe, input and input format live in the URL fragment (`#/?r=…&i=…&f=…`, deflate-raw and Base64url), so a link restores the workbench. Inputs that would make the link longer than 32 KiB are left out, with a notice. A "Copy link" button copies the link.
  - Links with more than 20 steps open with auto-bake off and a prompt to review the recipe first. Damaged links show a notice and leave the workbench unchanged.
- **Web app**, third slice:
  - Character search (`#/chars?q=…`) with the query language. Plain words search names, and a loose exact name match (UAX44-LM2) links straight to its character. Results show in a virtualised grid.
  - Character detail (`#/char/U+0645`): every property, aliases, and each escape format with a copy button.
  - Blocks (`#/blocks`, `#/blocks/Basic_Latin`) with assigned counts, and scripts (`#/scripts`, `#/scripts/Arab`) by Script or Script_Extensions.
  - Lookups run in their own worker, so they never wait behind a bake. The pages load on first visit.
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
- **Release workflow** (`.github/workflows/release.yml`): on a signed `v*` tag matching `VERSION`, builds the Python sdist and wheel, the npm tarball and CycloneDX SBOMs, attests them, publishes to PyPI, npm (dist-tag `next` for pre-releases) and GHCR, and creates the GitHub Release from the changelog section.
- **Spec:** shared vectors for every operation, with published known answers for hashing and AES.
- **Build:** the WHATWG HTML entity table pipeline (`scripts/html/build.py`), with SHA-256 lock verification.
- **Developer tooling:** the `ui-ux-pro-max` and `shadcn` agent skills, vendored for the responsive web UI work. They are not shipped.
- Logo masters, brand guide and the master generator script.
- UCD pipeline: `scripts/ucd/fetch.py` and `build.py`, the Unicode 18.0.0 source files and the three compiled data files.
- Shared spec: recipe, output and vector schemas, the error catalogue, and vectors for ten encoding ops.
- Repository scaffold: project constants, `VERSION`, licence and notices, and the Makefile skeleton.
