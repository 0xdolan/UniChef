# Unicode data

UniChef never uses the host's Unicode tables. Every Unicode property, name and mapping comes from the files in this folder, compiled by `scripts/ucd/build.py` (PRD §4.1).

| Path | What it is |
|---|---|
| `ucd.lock.json` | The pinned version, plus the URL and SHA-256 of every source file. |
| `<version>/` | The raw source files, unmodified, committed so builds work offline. `license.txt` is the Unicode License v3. `idna/` holds the UTS #46 files, which come from `<version>/idna/` for 17.0.0 and later, and from `Public/idna/<version>/` before that. |

The pinned version is `UCD_VERSION` in `project.constants.json`. It is currently **18.0.0**, the latest release at the time of writing. The minimum is 16.0.0.

## Commands

```sh
make ucd          # uv run scripts/ucd/fetch.py && uv run scripts/ucd/build.py
make ucd-check    # offline: verify the hashes, rebuild in memory, fail on drift (CI job ucd-drift)
uv run scripts/ucd/build.py --diff-from 18.0.0   # added characters, blocks and scripts
```

- **`fetch.py`** downloads only over HTTPS. A file whose hash differs from the lock is a hard failure, and the lock is left unchanged. To accept new hashes on purpose, delete the file and run the script again.
- **`build.py`** writes the same bytes to `packages/python-cli/src/unichef/_data/` and `packages/npm-core/data/`.
  - The output is deterministic: sorted keys, compact JSON, and gzip at level 9 with `mtime=0`.
  - `--check` compares the decompressed JSON. That way a different zlib build on another machine can't report false drift. It also requires the two copies to be byte-identical.
  - Each file must stay within its NFR-010 budget: core 400 KiB, names 900 KiB, security 150 KiB, all gzipped.

To bump the version, follow PRD §4.1.4:

1. Change `UCD_VERSION`.
2. Run `make ucd`.
3. Review the `--diff-from` report.
4. Update the conformance expectations.

## Build-time cross-checks

The build fails if any of these checks fails:

- The general category from `UnicodeData.txt` matches `extracted/DerivedGeneralCategory.txt` for every code point.
- Every name, explicit or derived (NR1 Hangul, NR2 prefix + hex), matches `extracted/DerivedName.txt`.
- Each NR2 pattern prefix is in the hard-coded table from the Unicode Standard Table 4-8 (`NR2_PREFIXES`).
- Each `<…, First>` range label in `UnicodeData.txt` is known (`RANGE_LABELS`).
- `CompositionExclusions.txt` is a subset of `Full_Composition_Exclusion`.
- No binary property is defined in two source files.
- Every property value resolves through `PropertyValueAliases.txt`.

## Compiled format

All three files are gzipped JSON objects with a `version` key. Code points are integers. Map keys are decimal code-point strings.

**Ranges.** Enumerated tables use run-length ranges, as a flat array of `[start, length, valueIndex, …]` sorted by start. Each `valueIndex` points into `values`, and any code point not covered by a range has the `default` value. Binary sets use `[start, length, …]`. Look a code point up with a binary search over the starts.

### `ucd-core-<version>.json.gz`

| Key | Content |
|---|---|
| `props` | Enumerated properties, each `{default, values, ranges}`: `gc`, `sc`, `blk`, `age`, `bc`, `ccc`, `ea`, `lb`, `GCB`, `InCB`, `NFC_QC`, `NFD_QC`, `NFKC_QC`, `NFKD_QC`. |
| `binary` | 64 binary properties, as `[start, length, …]`: those in `PropList.txt`, `DerivedCoreProperties.txt` and `emoji-data.txt`, plus `Bidi_Mirrored` from `UnicodeData.txt`. `Extended_Pictographic` is stored as `ExtPict`. |
| `scx` | `{sets, ranges}`. Each `sets` entry is a sorted list of short script codes. A code point outside every range uses its `sc` value. |
| `decomp` | `{cp: [tag, [cps]]}`. `tag` is `""` for canonical decompositions, otherwise for example `"<compat>"` or `"<font>"`. Hangul syllables are algorithmic and not listed. |
| `compExcl` | `Full_Composition_Exclusion` as `[start, length, …]`. |
| `case` | `upper`, `lower`, `title`: full mappings (UnicodeData simple mappings overlaid by unconditional SpecialCasing). Identity mappings are left out. An empty titlecase field falls back to uppercase. `fold`: CaseFolding C+F. `foldSimple`: S entries only, so simple folding is S, then C. `foldTurkic`: T entries. `special`: conditional SpecialCasing rows `[cp, lower, title, upper, conditions]`. |
| `blocks` | `[{name, start, end}]`, with names as written in `Blocks.txt`. |
| `aliases` | `prop`: every property alias → short name. `values`: per property, every value alias → the stored value. Match lookups with UAX44-LM3 loose matching. |

**Stored values.**

- Most properties store the short alias, for example `Lu`, `Arab`, `AL`, `W` or `1.1`.
- `blk` and `GCB` store the long alias (`Basic_Latin`, `No_Block`, `Other`), as PRD §4.2 does.
- `ccc` stores integers.
- Defaults that cover only part of the code space (the `@missing` lines, for example bc=R in the Hebrew block or lb=PR in Currency Symbols) are applied before the ranges are compressed.

### `ucd-names-<version>.json.gz`

| Key | Content |
|---|---|
| `names` | `[[cp, name], …]` for every explicitly named code point outside the ranges below. |
| `ranges` | `[[start, end, rule, prefix], …]`. `NR1` is a Hangul syllable: `prefix` + L + V + T Jamo short names. `NR2` is `prefix` + the code point in upper-case hex, at least 4 digits. |
| `jamo` | `{L, V, T}` Jamo short-name lists from `Jamo.txt`, for NR1. `T[0]` is `""`. |
| `aliases` | `[[cp, alias, type], …]` from `NameAliases.txt`. |

Display labels for unnamed code points (`<control-0000>` and so on) are computed at runtime from `gc` and `Noncharacter_Code_Point`.

### `ucd-security-<version>.json.gz`

| Key | Content |
|---|---|
| `confusables` | `{cp: [prototype cps]}` from `confusables.txt` (MA). |
| `idStatus` | `{default: "Restricted", allowed: [start, length, …]}`. |
| `idType` | `{default: "Not_Character", sets, ranges}`. Each set is a sorted list of identifier types. |
| `idna` | `{default: "X", values, ranges}` from `idna/IdnaMappingTable.txt` (UTS #46). A value is `"V"` (valid, or deviation: processing is nontransitional), `"I"` (ignored) or the list of cps a character maps to. `"X"` is disallowed. |
| `joiningType` | `{default: "U", values, ranges}` from `extracted/DerivedJoiningType.txt`, for the CONTEXTJ rules. |
