# Gap Analysis: CyberChef and UniView Compared with UniChef

Baseline: [UniChef-PRD.md](../../UniChef-PRD.md) v1.0.0. Upstream commits are listed in [README.md](README.md).

## 1. Capability matrix

| Capability | CyberChef | UniView | UniChef (PRD) |
|---|---|---|---|
| Recipe pipeline | Yes, linear with Fork/Merge | No | Yes, nested steps |
| Operation count | 506 | n/a | 79 mapped from CyberChef by 1.0, plus Unicode/security ops |
| Character database | No | Yes (UnicodeData, Blocks, Age, NamesList) | Yes (full UCD subset, §4.1) |
| NamesList annotations (aliases, cross-references, notes) | No | **Yes** | **No: gap G-U1** |
| Search by name or property | No | Name, alias and description search with regex; property search | Query language (§4.8) without description search |
| Block and range matrix view | No | **Yes**, with highlighting by property or age | Block grid; **no custom ranges or highlighting: G-U2** |
| Character edit buffer / picker | No | **Yes** | **No: G-U3** |
| Glyph images and font switching | No | Yes | **No: G-U4** |
| Script notes and links to the Core Spec | No | Yes (external) | No (not needed for 1.0) |
| Normalisation | `unorm` library | Host `String.normalize` | In-house, conformance-tested |
| Grapheme clusters | No | External app | In-house UAX #29 |
| Bidi, invisible-character and confusable detection | No | Partial (bidi listing via external app) | Yes (§4.7) |
| Input/output offset highlighting | **Yes** (`highlight`/`highlightReverse`) | No | **No: G-C1** |
| Auto-detect encoding ("Magic") | **Yes** | No | **No: G-C2** (post-1.0) |
| Registers (`$R0` capture for later arguments) | **Yes** | No | **No: G-C3** |
| Return (early stop) | Yes | No | **No: G-C4** |
| CLI | No (Node REPL/API only) | No | Yes |
| Python implementation | No | No | Yes |
| Browser extensions | No | No | Yes |
| Offline / no network | Yes | No (Unihan lookups, sibling apps) | Yes |
| Tests | 203 op test files plus Node and UI tests | None | Vectors, conformance tests, E2E |
| Licence status for reuse | Apache-2.0, cleared | Unclear | n/a |

## 2. What UniChef should take

**From CyberChef (licence-cleared):**

1. **Test cases.** Convert `tests/operations/tests/*.mjs` cases for the 79 mapped ops into `spec/vectors/` with provenance (details in [cyberchef.md §6](cyberchef.md#6-tests-reusable-as-unichef-vectors)). This gives a large start on FR-009 and compatibility.
2. **Recipe-import rules.** Accept both the JSON and the chef formats. Fold the linear `Fork`/`Subsection` … `Merge` structure into nested `steps`.
3. **Ideas worth adding to the PRD:**
   - per-op `highlight` offset mapping (G-C1),
   - per-op lazy-load module grouping,
   - argument validation declared in metadata.

**From UniView (design only, not code):**

1. Search over NamesList annotations (G-U1).
2. Matrix view of custom ranges, with highlighting by property or age (G-U2).
3. An edit buffer for collecting characters, converting them and expanding ranges (G-U3).
4. Lists grouped by bidi class, general category or line-break class. These are cheap to build on the query engine.

## 3. Recommended PRD changes

| ID | Change | PRD section | Milestone |
|---|---|---|---|
| G-U1 | Add `NamesList.txt` to the UCD sources. Compile aliases (`=`), cross-references (`→`), notes (`•`) and subheadings into `ucd-names`. Add `desc~/…/` to the query language. Show annotations on the character detail page. | §4.1, §4.3, §4.8, §6.4 | Alpha (data), Beta (UI) |
| G-U2 | Add a `#/range/<start>-<end>` route and `unichef block show --range`. Add highlighting of a block or range grid by any query expression. | §5.3, §6.4 | Beta |
| G-U3 | Add an "edit buffer" panel to the Chars page: collect characters; convert to hex or escapes and back; expand ranges; count; send to the Workbench as input. | §6.4 | Beta |
| G-U4 | Glyphs: render with a system font fallback stack and an optional user-chosen font. Shipping glyph images is out of scope; add this to the non-goals. | §1.3, §6.4 | Beta |
| G-C1 | Add an optional `highlight(range, args) → range` to `OperationDefinition`, so the Workbench can link input and output selections. Make it exact-class only and test it in vectors. | §3.3, §6.4 | Beta |
| G-C2 | List `magic` (encoding auto-detection) as a post-1.0 candidate in the non-goals. | §1.3 | post-1.0 |
| G-C3 | Either add `register` (regex captures into `$R<n>`, substituted into later string arguments) or have the CyberChef importer reject it explicitly. Recommendation: reject it in 1.0 and reconsider later. | §3.5, §3.4 | Beta |
| G-C4 | Add `return` (stop the bake early, keeping the current dish) as a flow op. It is cheap and needed to import many CyberChef recipes. | §3.5 | Alpha |
| G-I1 | CyberChef import must fold `Fork`/`Subsection` … `Merge` into nested `steps`, and must translate display-string arguments such as Base64 alphabets. Add both rules to §3.4. | §3.4 | Beta |
| G-V1 | Unicode baseline: UniView already uses Unicode 18.0.0 draft NamesList data. Set the PRD's `UCD_VERSION` to the latest **released** version when implementation starts (check https://www.unicode.org/versions/latest/), keeping 16.0.0 as the minimum. | §0.1, §4.1.4 | Alpha |

## 4. What UniChef deliberately leaves out

- The 427 CyberChef operations listed as "not planned" in [cyberchef-operations.md](cyberchef-operations.md). This includes the WWII cipher machines, multimedia, disassembly, public-key cryptography and many legacy ciphers. They can be added after 1.0 when someone asks for them.
- UniView's dependence on other r12a apps and on network Unihan lookups, because they conflict with SEC-001.
- UniView's manual Perl data pipeline.
