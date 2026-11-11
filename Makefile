# SPDX-License-Identifier: GPL-3.0-or-later
# UniChef developer entry points (PRD §11.8). Run `make help` for the list.
# Requires GNU Make >= 4 and bash. On Windows, use WSL2 or `make docker-ci`.

SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-builtin-rules --warn-undefined-variables

COMPOSE := docker compose -f docker/docker-compose.yml
V ?=

# Targets whose tooling lands in a later build step stop with a clear message. Under
# `make ci` they are skipped instead, so the pipeline covers every stage that exists.
ifneq ($(filter ci,$(MAKECMDGOALS)),)
define not_yet
@echo "make $@: skipped; it arrives with $(1) (PRD §16.1)." >&2
endef
else
define not_yet
@echo "make $@: not available yet; it arrives with $(1) (PRD §16.1)." >&2; exit 2
endef
endif

.PHONY: help bootstrap fmt lint typecheck test-py test-ts test perf parity e2e ucd ucd-check entities entities-check \
	ops ops-check assets screenshots build-py build-npm build-web pages build-ext build deb-check \
	version version-check release-verify traceability ci docker-ci clean

help: ## List the available targets
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} \
		/^[a-zA-Z0-9_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

bootstrap: ## Install Git LFS objects, pnpm and uv environments and the pre-commit hook
	corepack enable
	pnpm install --frozen-lockfile
	cd packages/python-cli && uv sync --locked --all-groups

fmt: ## Format Python (ruff) and TypeScript (prettier) sources
	cd packages/python-cli && uv run ruff check --fix . && uv run ruff format .
	pnpm fmt

lint: ## Run ruff, ESLint, Prettier and the SVG master checks as CI does
	cd packages/python-cli && uv run ruff check . && uv run ruff format --check .
	pnpm -r lint
	pnpm fmt:check
	uv run scripts/assets/build.py --lint

typecheck: ## Run mypy --strict and tsc --noEmit
	cd packages/python-cli && uv run mypy
	pnpm -r typecheck

test-py: ## Run the Python unit and integration tests
	cd packages/python-cli && uv run pytest

test-ts: ## Run the TypeScript unit tests
	pnpm -r test

test: test-py test-ts ## Run all unit and integration tests

perf: ## Check the core performance budgets (NFR-002, NFR-004) without coverage
	cd packages/python-cli && uv run pytest tests/perf -m perf --no-cov
	pnpm --filter @unichef/core perf

parity: ## Run the shared test vectors in both languages and cross-check results
	mkdir -p reports
	cd packages/python-cli && uv run pytest tests/parity --no-cov --junitxml=../../reports/py-parity.xml
	cd packages/npm-core && pnpm exec vitest run test/parity --reporter=default --reporter=junit --outputFile.junit=../../reports/ts-parity.xml
	uv run scripts/parity-report.py reports/py-parity.xml reports/ts-parity.xml

e2e: build-web ## Run the Playwright end-to-end tests against the built web app
	pnpm --filter web e2e

ucd: ## Fetch and verify the UCD, compile it and write it to both packages
	uv run scripts/ucd/fetch.py
	uv run scripts/ucd/build.py

ucd-check: ## Rebuild the UCD artefacts and fail if they drift from the committed ones
	uv run scripts/ucd/fetch.py --offline
	uv run scripts/ucd/build.py --check

entities: ## Verify the pinned WHATWG entity list and write html-entities.json.gz to both packages
	uv run scripts/html/build.py

entities-check: ## Rebuild the HTML entity artefact and fail if it drifts from the committed one
	uv run scripts/html/build.py --check

ops: ## Regenerate spec/ops.json from the Python operation registry
	uv run --project packages/python-cli --locked python scripts/spec/ops.py

ops-check: ## Fail if spec/ops.json drifts from the Python operation registry
	uv run --project packages/python-cli --locked python scripts/spec/ops.py --check

assets: ## Build favicons, icons and store images from the branding masters
	uv run scripts/assets/build.py

screenshots: build-web build-ext ## Capture CLI, web and extension screenshots into assets/docs/screenshots/
	uv run --project packages/python-cli --locked python scripts/screenshots/cli.py
	cd clients/web && pnpm exec playwright test -c playwright.screenshots.config.ts

build-py: ## Build the Python sdist and wheel into dist/
	cd packages/python-cli && uv build --out-dir ../../dist/python

build-npm: ## Build the @unichef/core npm package into dist/
	pnpm --filter @unichef/core build

build-web: ## Build the web app into clients/web/dist/ and check its bundle budgets
	pnpm --filter web build
	node scripts/check-bundle.mjs

pages: build-web ## Build the GitHub Pages site: the web app plus the core's API docs in api/
	pnpm --filter @unichef/core api-docs

build-ext: ## Build the browser extensions into clients/extensions/common/dist/
	test -f assets/branding/dist/ext/128.png || uv run scripts/assets/build.py --only ext/
	pnpm --filter extensions build

build: build-py build-npm build-web build-ext ## Build every artefact

deb-check: ## Build the .deb, run lintian and autopkgtest in Ubuntu (SERIES=24.04 by default)
	@if command -v docker > /dev/null; then $(COMPOSE) run --rm deb; \
	elif [ -n "$(filter ci,$(MAKECMDGOALS))" ]; then echo "make $@: skipped; it needs Docker." >&2; \
	else echo "make $@: needs Docker (it builds in a clean Ubuntu container)." >&2; exit 2; fi

version: ## Set the project version everywhere: make version V=x.y.z
	@test -n "$(V)" || { echo "Usage: make version V=x.y.z" >&2; exit 2; }
	uv run scripts/version/sync.py "$(V)"

release-verify: ## Check a published release: assets, SHA256SUMS, attestations, registries (V=x.y.z)
	@test -n "$(V)" || { echo "Usage: make release-verify V=x.y.z" >&2; exit 2; }
	scripts/release/verify.sh "$(V)"

version-check: ## Fail if any file disagrees with VERSION; run the release tooling tests
	uv run scripts/version/check.py
	uv run --with pytest==9.2.0 pytest scripts -q -p no:cacheprovider

traceability: ## Fail if a PRD requirement ID is referenced by no test or CI step
	uv run scripts/check-traceability.py

ci: lint typecheck test parity ucd-check entities-check ops-check version-check traceability build deb-check ## Run the full CI pipeline locally

docker-ci: ## Run CI and E2E inside the dev container
	$(COMPOSE) run --rm --build ci
	@if [ -f clients/web/playwright.config.ts ]; then $(COMPOSE) run --rm e2e; \
	else echo "make e2e: skipped; it arrives with the web app's end-to-end tests (PRD §16.1)." >&2; fi

clean: ## Remove build output and caches
	rm -rf dist build reports assets/branding/dist node_modules/.cache
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .mypy_cache \
		-o -name .ruff_cache \) -prune -exec rm -rf {} +
