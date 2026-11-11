# Upstream Projects: Investigation Notes

UniChef takes ideas from two existing projects. These notes record what each one contains, how it is built, its licence status, and what UniChef should and should not take from it.

| Project | Repository | Commit investigated | Date | Licence |
|---|---|---|---|---|
| CyberChef | https://github.com/gchq/CyberChef | `d4d96c6c3d2597fef836d81bfc04617d97c681a5` (v11.5.0) | 2026-11-04 | Apache-2.0 (`LICENSE` file; no `NOTICE` file) |
| UniView | https://github.com/r12a/uniview | `bb0f6476e2d34237efc8f6b6ff116e384a2a888d` | 2026-09-22 | **Unclear.** See [uniview.md §5](uniview.md#5-licence-findings). |

## Files

| File | Contents |
|---|---|
| [cyberchef.md](cyberchef.md) | Architecture, data model, recipe formats, tests and licence obligations. |
| [cyberchef-operations.md](cyberchef-operations.md) | All 506 CyberChef operations by category, each mapped to a UniChef op id or marked "not planned". |
| [uniview.md](uniview.md) | Feature inventory, data pipeline, data format and licence findings. |
| [gap-analysis.md](gap-analysis.md) | What each project has and lacks compared with UniChef, plus recommended changes to [UniChef-PRD.md](../../UniChef-PRD.md). |

## Refreshing these notes

1. Shallow-clone each repository into a temporary directory outside this repo:

   ```sh
   git clone --depth 1 https://github.com/gchq/CyberChef.git
   git clone --depth 1 https://github.com/r12a/uniview.git
   ```

2. Regenerate the operation inventory from `src/core/config/Categories.json`.
3. Update the commit hashes in the table above.
4. Read the licence files again.
5. Delete the clones. Upstream code is never committed to this repository.
