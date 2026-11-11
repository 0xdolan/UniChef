# Contributing to UniChef

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately as described in [SECURITY.md](SECURITY.md), not in issues. Issues and pull requests use the templates in `.github/`.

## Branches (Gitflow)

| Branch | Cut from | Merges into | Use |
|---|---|---|---|
| `main` | n/a | n/a | Released code only. Every commit is tagged `vX.Y.Z`. |
| `develop` | `main` | `release/*` | Integration branch |
| `feature/<slug>` | `develop` | `develop` | New functionality |
| `bugfix/<slug>` | `develop` | `develop` | Non-urgent fixes |
| `docs/<slug>`, `chore/<slug>` | `develop` | `develop` | Documentation and maintenance |
| `release/X.Y.Z` | `develop` | `main`, then back into `develop` | Stabilising a release. Fixes only. |
| `hotfix/X.Y.Z` | `main` | `main`, then back into `develop` | Urgent production fixes |

Branch names must match:

```
^(feature|bugfix|docs|chore)/[a-z0-9][a-z0-9._-]{1,60}$|^(release|hotfix)/\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$
```

Pull requests into `develop` are squash-merged. Release and hotfix pull requests into `main` use a merge commit.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): summary`, with the summary in the imperative mood and no full stop. The types are `feat`, `fix`, `docs`, `chore`, `build`, `ci`, `test`, `refactor` and `perf`. The changelog is generated from these messages.

## Source files

- Start every source file with an SPDX header: `# SPDX-License-Identifier: GPL-3.0-or-later` in Python, `// SPDX-License-Identifier: GPL-3.0-or-later` in TypeScript.
- Do not commit the planning documents (`PRD.md`, `PROMPT.md`, `UniChef-PRD.md`). They are listed in `.gitignore`.
- Third-party code or data needs an entry in `THIRD_PARTY_NOTICES.md` in the same change.
- Files under `assets/branding/source/` and `assets/docs/` are append-only (GOV-020). To change one, add a new versioned file. See `docs/branding/README.md`. The `assets-guard` check fails a pull request that changes or deletes an existing file, unless an owner of `/assets/` in CODEOWNERS adds the `assets-change-approved` label. Regenerating the screenshots with `make screenshots` needs that label.

## Local setup

`make help` lists the developer commands. They need GNU Make 4 and bash. On Windows, use WSL2 or run `make docker-ci`.

## Tests and quality gates

- Every change ships with a test that CI runs. Name the test after the PRD requirement it proves (`FR-001: …`, `NFR-043: …`). `make traceability` fails if a requirement has no test.
- Web UI changes must keep the desktop and phone e2e projects green: no sideways scrolling at phone width, touch targets of at least 24 × 24 px, form fields of at least 16 px on touch screens, and no serious axe findings in either theme.
- Use only the brand assets from `assets/branding/source/` and the colour tokens in `clients/web/src/styles/tokens.css`. The name is shown as the outlined lockup, never as live text in a webfont.
- Add a manual QA item to `docs/release/qa-checklist.md` only for something a machine cannot check, such as a real device or a store dialog.

## Releases

[docs/release/process.md](docs/release/process.md) describes the gates, every artefact a release must ship, and the steps from `release/X.Y.Z` to a signed tag. `make release-verify V=X.Y.Z` checks a published release.
