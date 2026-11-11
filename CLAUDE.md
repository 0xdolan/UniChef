# UniChef: rules for coding agents

- Follow [CONTRIBUTING.md](CONTRIBUTING.md): Gitflow branch names, Conventional Commits, one test per change named after its PRD ID.
- Releases and QA: the `release-qa` skill and [docs/release/process.md](docs/release/process.md). Automate a check before adding a manual QA item.
- Never add an AI as author, co-author or contributor in commits, PRs, issues, release notes or files. Commit only as the configured git identity.
- Never push tags, cancel workflow runs, force-push, edit rulesets, delete remote branches or approve deployment environments. Give the maintainer the commands instead.
- Pin every GitHub Action to a full commit SHA with a version comment, copied from an existing workflow, and run `actionlint` on workflow changes.
- Brand: only the masters in `assets/branding/source/` and the tokens in `clients/web/src/styles/tokens.css`. See [docs/branding/README.md](docs/branding/README.md).
