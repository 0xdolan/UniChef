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
