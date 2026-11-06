# Third-Party Notices

UniChef is licensed under GPL-3.0-or-later (see `LICENSE`). This file lists third-party material that is part of the repository or its build output, with its licence. Add an entry whenever such material is added, and mirror it in `debian/copyright`.

## Bricolage Grotesque (logo wordmark outlines)

- **Used in:** `assets/branding/source/unichef-logo*.svg`. The wordmark is glyph outlines generated from the font. No font software is distributed.
- **Source:** https://github.com/ateliertriay/bricolage, via https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque (version 1.001).
- **Copyright:** Copyright 2022 The Bricolage Grotesque Project Authors.
- **Licence:** SIL Open Font License 1.1, https://openfontlicense.org.

## Unicode Character Database and UTS #39 data

- **Used in:** `data/ucd/18.0.0/` (raw files, unmodified) and the generated `ucd-*.json.gz` files in `packages/python-cli/src/unichef/_data/` and `packages/npm-core/data/`.
- **Source:** https://www.unicode.org/Public/18.0.0/ (`ucd/` and `security/`). URLs and SHA-256 hashes are in `data/ucd/ucd.lock.json`.
- **Copyright:** Copyright © 1991-2026 Unicode, Inc.
- **Licence:** Unicode License v3, https://www.unicode.org/license.txt (copy in `data/ucd/18.0.0/license.txt`).

## WHATWG HTML named character references

- **Used in:** `data/html/entities.json` (unmodified) and the generated `html-entities.json.gz` files in `packages/python-cli/src/unichef/_data/` and `packages/npm-core/data/`.
- **Source:** https://html.spec.whatwg.org/entities.json. The SHA-256 is pinned in `data/html/entities.lock.json`.
- **Copyright:** Copyright © WHATWG (Apple, Google, Mozilla, Microsoft).
- **Licence:** Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/.

## Planned entries

These are not in the repository yet. Each entry must be added here in the same change that brings in the material.

| Material | Licence | Added in |
|---|---|---|
| CyberChef test cases and any ported code | Apache-2.0, Crown Copyright | CyberChef import and vectors |
