# SPDX-License-Identifier: GPL-3.0-or-later
# UniChef developer entry points (PRD §11.8). Run `make help` for the list.
# Requires GNU Make >= 4 and bash. On Windows, use WSL2 or `make docker-ci`.

SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-builtin-rules --warn-undefined-variables

COMPOSE := docker compose -f docker/docker-compose.yml
V ?=

# Targets whose tooling lands in a later build step stop with a clear message.
define not_yet
@echo "make $@: not available yet; it arrives with $(1) (PRD §16.1)." >&2; exit 2
endef

.PHONY: help bootstrap fmt lint typecheck test-py test-ts test parity e2e ucd ucd-check \
	assets screenshots build-py build-npm build-web build-ext build deb-check version \
	ci docker-ci clean

help: ## List the available targets
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} \
		/^[a-zA-Z0-9_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

bootstrap: ## Install Git LFS objects, pnpm and uv environments and the pre-commit hook
	$(call not_yet,the TypeScript and Python cores)

fmt: ## Format Python (ruff) and TypeScript (prettier) sources
	$(call not_yet,the Python core)

lint: ## Run ruff, ESLint and Prettier checks as CI does
	$(call not_yet,the Python core)

typecheck: ## Run mypy --strict and tsc --noEmit
	$(call not_yet,the Python core)

test-py: ## Run the Python unit and integration tests
	$(call not_yet,the Python core)

test-ts: ## Run the TypeScript unit tests
	$(call not_yet,the TypeScript core)

test: test-py test-ts ## Run all unit and integration tests

parity: ## Run the shared test vectors in both languages and cross-check results
	$(call not_yet,the TypeScript core)

e2e: ## Run the Playwright end-to-end tests
	$(call not_yet,the web app)

ucd: ## Fetch and verify the UCD, compile it and write it to both packages
	uv run scripts/ucd/fetch.py
	uv run scripts/ucd/build.py

ucd-check: ## Rebuild the UCD artefacts and fail if they drift from the committed ones
	uv run scripts/ucd/fetch.py --offline
	uv run scripts/ucd/build.py --check

assets: ## Build favicons, icons and store images from the branding masters
	$(call not_yet,the assets step)

screenshots: ## Capture CLI and web screenshots
	$(call not_yet,the assets step)

build-py: ## Build the Python sdist and wheel into dist/
	$(call not_yet,the CLI)

build-npm: ## Build the @unichef/core npm package into dist/
	$(call not_yet,the TypeScript core)

build-web: ## Build the web app into dist/
	$(call not_yet,the web app)

build-ext: ## Build the browser extensions into dist/
	$(call not_yet,the extensions)

build: build-py build-npm build-web build-ext ## Build every artefact

deb-check: ## Run the Debian packaging pre-flight checks
	$(call not_yet,the Debian packaging)

version: ## Set the project version everywhere: make version V=x.y.z
	@test -n "$(V)" || { echo "Usage: make version V=x.y.z" >&2; exit 2; }
	$(call not_yet,the release tooling)

ci: lint typecheck test parity ucd-check build deb-check ## Run the full CI pipeline locally

docker-ci: ## Run CI and E2E inside the dev container
	$(COMPOSE) run --rm ci
	$(COMPOSE) run --rm e2e

clean: ## Remove build output and caches
	rm -rf dist build assets/branding/dist node_modules/.cache
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .mypy_cache \
		-o -name .ruff_cache \) -prune -exec rm -rf {} +
