---
name: uniview-reference
description: Reference for UniView (r12a/uniview) as it relates to UniChef. Use when designing or implementing character-browsing features (character lookup, search over names, aliases or NamesList annotations, block/range matrix views, property highlighting, the character edit buffer), when extending the UCD pipeline with NamesList.txt, or when the question is whether UniView code may be reused (licence).
---

# UniView reference for UniChef

Investigated at UniView commit `bb0f6476e2d34237efc8f6b6ff116e384a2a888d` (2026-09-22). Full notes:

- `docs/upstream/uniview.md`: feature inventory, data format, pipeline, licence findings.
- `docs/upstream/gap-analysis.md`: the UniView-inspired PRD changes G-U1 to G-U4 and G-V1.

## Licence: read this first

UniView has **no LICENSE file** and contradicts itself:

- the HTML header comments say "All rights reserved",
- the page footers say CC BY 4.0.

**Do not copy UniView code, CSS, images or data files.** Reimplement its features from the Unicode specifications and the UCD. This stays in force until the author confirms the licence in writing or adds a `LICENSE` file at a pinned commit (PRD Decision D4). Using UniView's feature set as design inspiration is allowed.

For NamesList annotations, download `NamesList.txt` from unicode.org (Unicode License v3). Never take them from UniView's `descriptions.js`.

## Features worth matching (all built on UniChef's own engine)

| UniView feature | UniChef implementation |
|---|---|
| Search names, aliases and NamesList descriptions (regex) | Query language `name~/…/` plus the proposed `desc~/…/` (G-U1) |
| Search by property | `gc=…`, `sc=…`, `age<=…` query (PRD §4.8) |
| Block or custom-range matrix with highlighting by property or age | `#/blocks/<name>`, the proposed `#/range/<a>-<b>` route, and highlighting by query (G-U2) |
| Edit buffer: collect characters, convert to hex or escapes and back, expand `a-z` ranges, count, NFC/NFD | Chars-page buffer panel that feeds Workbench input (G-U3). Conversions reuse the `escape-unicode`, `to-code-points` and `normalize` ops. |
| Annotated character list | `analyse-characters` table plus NamesList annotations |
| Lists by bidi class, general category, line break or Indic syllabic category | Query presets on the Chars page |
| Glyph as font or image | Font fallback stack plus a user-selected font. Glyph images are out of scope (G-U4). |

## UniView behaviour to avoid

- Calling host `String.prototype.normalize` (UniChef requires in-house UAX #15).
- Network calls such as the Unihan lookup at unicode.org, and hand-offs to external apps. These violate SEC-001.
- Manual data refresh steps. UniChef data comes only from `scripts/ucd/fetch.py` and `build.py`.
- A packed `U[cp]` string format with per-character entries (2.7 MB raw). UniChef uses run-length range tables (PRD §4.2) to meet its bundle budgets.

UniView's data already tracks Unicode **18.0.0 (draft)**. When setting `UCD_VERSION`, use the latest *released* version from https://www.unicode.org/versions/latest/ (G-V1).
