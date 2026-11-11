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

## SchemaStore Chrome manifest schema (build check, not shipped)

- **Used in:** `clients/extensions/common/build/chrome-manifest.schema.json` (unmodified). The extension build validates the Chrome and Edge manifests against it; it is not part of any package.
- **Source:** https://github.com/SchemaStore/schemastore `src/schemas/json/chrome-manifest.json` at commit `1ec8595a0e53d5ae5b81c3888dff2161f5d43100` (SHA-256 `8fc2fe8078ed7c05dce7b6e3e969e160ca3ba20e22e410ab42dc801fcae8492a`).
- **Copyright:** Copyright SchemaStore contributors.
- **Licence:** Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0.

## Contributor Covenant (Code of Conduct)

- **Used in:** `CODE_OF_CONDUCT.md`. Only the enforcement contact was filled in.
- **Source:** https://www.contributor-covenant.org/version/2/1/code_of_conduct/ (version 2.1).
- **Copyright:** Copyright Contributor Covenant contributors.
- **Licence:** Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/.

## Development-only agent skills (not shipped)

These guide AI-assisted UI work. They are not part of any package or build output.

- **ui-ux-pro-max:** in `.claude/skills/ui-ux-pro-max/`. The source is https://github.com/nextlevelbuilder/ui-ux-pro-max-skill at commit `b7d5353e0130feb8c5574ef1251f8a1db1873ccb`; its upstream tests were left out, and the script paths in `SKILL.md` were changed to project-relative ones. Copyright (c) 2024 Next Level Builder. MIT License (copy in that directory).
- **shadcn:** in `.claude/skills/shadcn/`. The source is https://github.com/shadcn-ui/ui `skills/shadcn/` at commit `42f3bb63b46a69e52a24bd005cdc9ec15ba7a7b9`; `evals/` and `agents/` were left out. Copyright (c) 2023 shadcn. MIT License (copy in that directory).

## Planned entries

These are not in the repository yet. Each entry must be added here in the same change that brings in the material.

| Material | Licence | Added in |
|---|---|---|
| CyberChef test cases and any ported code | Apache-2.0, Crown Copyright | CyberChef import and vectors |
