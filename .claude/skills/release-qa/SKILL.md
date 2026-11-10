---
name: release-qa
description: UniChef release and QA process. Use when preparing, cutting, verifying or auditing a release or release candidate (release/X.Y.Z branches, make version, tags, GitHub Releases, PyPI, npm, GHCR, PPA, extension stores, Pages), when adding or checking a release artefact, or when deciding whether a change needs an automated test, a CI gate or a manual QA item.
---

# Release and QA for UniChef

The source of truth is `docs/release/process.md` (gates, artefact table, steps). The manual
list is `docs/release/qa-checklist.md`. Read only the section you need.

## Rules

1. **Automate first.** A new behaviour gets a test that CI runs. Put a check on the manual
   list only for what a machine cannot judge: a real device, a store dialog, how a thing
   looks. When you add a manual item, say why it cannot be automated.
2. **Trace it.** Every test name or CI step carries the PRD ID it proves (`NFR-043: …`).
   `make traceability` fails on an uncovered ID. A new requirement means a new ID in the PRD
   and in `scripts/traceability-ids.txt` (`uv run scripts/check-traceability.py --write`).
3. **Every artefact, every release.** Adding or renaming an artefact means changing all of:
   `release.yml` (build, `attest` subject, `github-release` files), the table in
   `docs/release/process.md`, and the `expected` list in `scripts/release/verify.sh`.
4. **Pinned actions.** Every `uses:` is a full commit SHA with a `# vX.Y.Z` comment. Copy an
   existing pin from another workflow rather than guessing a SHA. Run `actionlint` on changed
   workflows.
5. **Never do these yourself:** push a tag, cancel a run, force-push, edit rulesets, delete a
   remote branch, approve a deployment environment. Give the maintainer the exact commands.
6. **No AI attribution** in commits, tags, release notes, changelogs or package metadata.
   The release identity is the maintainer in `debian/control`.

## Checks to run

| Change | Run |
|---|---|
| Web UI | `make lint typecheck test-ts`, `pnpm --filter web build`, then e2e. WebKit needs system libraries the host may lack; run the suite in the CI image: `docker run --rm --network host -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD:/src" -w /src/clients/web mcr.microsoft.com/playwright:v<locked>-noble sh -c 'unset CI; npx playwright test'` |
| Phone layout | The `mobile-chrome` and `mobile-safari` projects (`e2e/mobile.spec.ts`): no sideways scroll, targets ≥ 24 px, fields ≥ 16 px, the menu works, manifest icons resolve |
| Brand or icons | `uv run scripts/assets/build.py --lint`; `--only web/` needs rsvg-convert, ImageMagick and oxipng (the `unichef-ci` image) |
| Debian | `make deb-check`; release packages use `scripts/deb/check.sh --out DIR` |
| Workflows | `actionlint`; shellcheck on changed scripts |
| A published release | `make release-verify V=X.Y.Z-rc.N` |

## Cutting an RC

Follow `docs/release/process.md` §3. In short: `release/X.Y.Z` from `develop`, then
`make version V=X.Y.Z-rc.1`, review `CHANGELOG.md`, `make ci`, and open the pull request into
`main`. Then hand the maintainer the signed-tag commands. After the tag, watch `release.yml`
through `verify-release`, and post `qa-checklist.md` into the tracking issue.
