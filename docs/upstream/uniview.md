# UniView: Investigation Notes

Commit `bb0f6476e2d34237efc8f6b6ff116e384a2a888d` (2026-09-22). The live app is at https://r12a.github.io/uniview/ and the help page at https://r12a.github.io/uniview/help.

## 1. What it is

UniView is a single-page character browser by Richard Ishida (r12a). Its README describes it as a tool to:

> look up and see characters (using graphics or fonts) and property information, view whole character blocks or custom ranges, select characters to paste into your document, paste in and discover unknown characters, search for characters, do hex/dec/ncr conversions, highlight character types.

Its data already tracks the **Unicode 18.0.0 draft names list** (header of `descriptions.js`).

## 2. Repository layout

| Path | Contents |
|---|---|
| `index.html` (1 426 lines) | The whole UI |
| `functions.js` (3 327 lines) | All behaviour, as about 120 global functions with no modules and no build step |
| `u.js` (2.7 MB; 353 KB gzipped) | `U[cp] = "NAME;gc;ccc;bc;decomp;uc;lc;tc;age;subtitle;…"` for 41 341 explicitly listed code points |
| `descriptions.js` (969 KB; 212 KB gzipped) | `desc[cp]` holding annotations from `NamesList.txt`: aliases (`=`), cross-references (`→`), notes (`•`) and equivalents (`≈`, `~`) |
| `subtitles.js` | Names-list subheadings (e.g. "Creative Commons symbols") |
| `agemap.js`, `propNames.js` | Age lookup, and long names for property values |
| `GENERATE DATA/` | Perl generators (`genU.plx`, `genDescriptions.plx`, `genScriptGroups.plx`, `genDerivedAge.plx`, `genMenu.plx`), a manual checklist (`PROCESS.txt`) and copies of the source UCD files |
| `generateSVG/`, `makeSVG*` | Python and JS tooling that turns a font into per-character SVG glyph images, which are copied into a separate repository |
| `images/`, `slices/` | UI icons, and Photoshop slice sources |
| `help.html`, `versiondata.html` | User guide and version history |

## 3. Feature inventory

**Lookup and search**
- Look up by hex or decimal code point, or by escapes.
- Search character names, alternative names (aliases) and NamesList descriptions. The search accepts regex syntax.
- Search for characters with a given property.
- Find a block by typing its name.

**Browsing**
- View a block or a custom range as a matrix (table) or a list, with or without numbers and the `U+` prefix.
- Highlight characters in the view by property or by age.
- Group results by Unicode block.
- Navigate by "script groups": 346 entries built from `Blocks.txt` plus NamesList subheadings.

**Edit buffer ("picker")**
- Collect characters.
- Convert the buffer to hex or to escapes, and back again.
- Expand ranges such as `a-zA-Z`.
- Separate characters with commas or spaces, and remove spaces.
- Count characters.
- Normalise to NFC or NFD.
- Create a list from the buffer.
- Produce an annotated list.
- Generate HTML markup.

**Character detail**
- All `UnicodeData.txt` fields, the age, and the NamesList annotations.
- Glyph shown as a font character or as an image, with the font and size selectable.
- User-supplied character notes.
- Links to the relevant chapter of the Unicode Core Specification.

**Hand-offs to other r12a apps** (opened with `window.open` on sibling paths such as `../app-analysestring/`, `../app-conversion/` and `../scripts/apps/graphemes/`):
- Analyse String.
- Character Usage.
- Unicode Converter.
- Grapheme clusters.
- Lists by bidi class, general category, line break and Indic syllabic category.
- Script notes, font lists and Noto font downloads.

**Unihan**
- Opens `http://www.unicode.org/cgi-bin/GetUnihanData.pl` in a new window, over plain HTTP and using the network.

**Sharing**
- URL parameters that reproduce the current view.

## 4. Implementation characteristics (relevant to UniChef)

| Aspect | UniView | UniChef requirement |
|---|---|---|
| Normalisation | `str.normalize('NFC' or 'NFD')`, the host engine | In-house UAX #15 implementation from the pinned UCD |
| Graphemes, bidi lists, line breaking | Delegated to other r12a apps | In-house UAX #29; property data in `ucd-core` |
| Data refresh | Manual six-step Perl process (`PROCESS.txt`), including hand edits such as "Search & replace all & to &amp;" | Scripted, checksum-locked and reproducible (`scripts/ucd/`) |
| Data scope | `UnicodeData`, `Blocks`, `DerivedAge`, `NamesList` | Adds Scripts/ScriptExtensions, case data, normalisation data, emoji, GCB/InCB and UTS #39 |
| Properties shown | `UnicodeData` fields plus age | Adds script, scx, ea, binary properties and security flags |
| Network | Unihan lookup on unicode.org; sibling apps | None |
| Tests | None | Conformance tests plus shared test vectors |
| Code structure | Global functions, DOM-coupled, no build | Typed modules, worker execution |

## 5. Licence findings

The repository contains **no `LICENSE` file**, and the files make two statements that contradict each other:

- **"All rights reserved":** the header comment of `index.html` and `makeSVG.html` reads `© Copyright 2001-2022 Richard Ishida [ishida@w3.org]. All rights reserved.`
- **CC BY 4.0:** the visible footers of `index.html`, `makeSVG.html`, `help.html` and `versiondata.html` read "Licence CC-By", linking to `http://creativecommons.org/licenses/by/4.0/`.

The data files carry their own terms: `descriptions.js` and `subtitles.js` are derived from Unicode's `NamesList.txt` and point to https://www.unicode.org/terms_of_use.html.

**Conclusion (Decision D4 in the PRD).**
- Treat UniView **code** as not cleared for copying until the author confirms CC BY 4.0 in writing, or adds a `LICENSE` file at a commit we pin.
- Reimplement the features from the Unicode specifications and the UCD.
- Taking UniView's feature set as design inspiration is fine.
- Get `NamesList.txt` directly from unicode.org under the Unicode License v3, not from `descriptions.js`.

If the licence is later confirmed as CC BY 4.0, reuse requires attribution: credit "UniView by Richard Ishida (r12a), CC BY 4.0", link to the licence, and state that changes were made. Record this in `THIRD_PARTY_NOTICES.md` and `debian/copyright`.
