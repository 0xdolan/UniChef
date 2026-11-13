---
name: cyberchef-reference
description: Reference for CyberChef (gchq/CyberChef) as it relates to UniChef. Use when porting or comparing an operation, writing or extending the CyberChef recipe importer (spec/cyberchef-map.json), converting CyberChef tests into spec/vectors, mapping CyberChef positional args to UniChef named args, or checking Apache-2.0 attribution rules for ported code.
---

# CyberChef reference for UniChef

Investigated at CyberChef commit `d4d96c6c3d2597fef836d81bfc04617d97c681a5` (v11.5.0, Apache-2.0). Full notes:

- `docs/upstream/cyberchef.md`: architecture, op model, recipe formats, tests, licence.
- `docs/upstream/cyberchef-operations.md`: all 506 ops mapped to UniChef op ids (140 mapped, 366 not yet covered).
- `docs/upstream/gap-analysis.md`: what to adopt, and the proposed PRD changes (G-C*, G-I1).

Read only the section you need. Use Grep on the operations table rather than reading the whole file.

## Key facts

- Ops are identified by **display name** (`"To Base64"`) and take **positional** args. Arg values are often display strings: the Base64 alphabet is `"A-Za-z0-9+/="`, and the escape prefix is one of `"\\u"`, `"%u"` or `"U+"`. UniChef uses kebab-case ids and named args, so every mapping must translate values and reject anything it cannot translate.
- There are two recipe formats:
  - JSON: `[{"op":"…","args":[…],"disabled"?:true,"breakpoint"?:true}]`
  - Chef format: `To_Base64('A-Za-z0-9+/=')`, with `/disabled` and `/breakpoint` suffixes. It is parsed by `Utils.parseRecipeConfig`.
- **Flow control is linear.** `Fork` and `Subsection` apply until `Merge`. The importer folds the ops in between into UniChef's nested `steps`. `Register` (`$R0` captures) has no UniChef equivalent, so reject it with `E_OP_UNKNOWN`. `Return` maps to the proposed `return` op (G-C4). `Magic` is not planned.
- **Test format:** `TestRegister.addTests([{name, input, expectedOutput, recipeConfig}])` in `tests/operations/tests/*.mjs`. To convert a case to a vector:
  1. Map its args through `spec/cyberchef-map.json`.
  2. Add a `"source": "cyberchef@<commit>:<path>"` field.
- **CyberChef Unicode handling is weak, so don't copy it.**
  - Normalise Unicode uses the `unorm` library.
  - Remove Diacritics uses host `normalize("NFD")` and strips only U+0300–U+036F.

  UniChef must use its own UCD-driven algorithms (PRD §4.4, §16.6).

## Rules when porting code or tests

1. Port only ops listed with a UniChef id in `cyberchef-operations.md`. To add a new one, update the PRD op catalogue (§3.8) first.
2. Keep CyberChef's copyright header (`@author …`, `@copyright Crown Copyright <year>`) and add "Modified by UniChef contributors, <year>". Then add an entry to `THIRD_PARTY_NOTICES.md` and a stanza to `debian/copyright`.
3. Port to both Python and TypeScript, and prove parity with vectors.
4. Never use CyberChef or GCHQ names or logos in UniChef branding.
5. If you need source that isn't in the notes, shallow-clone it into a temporary directory outside the repo, read it, and delete the clone afterwards. Never commit upstream source.
