#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Generate the Safari Web Extension Xcode project (PRD §7.7). Needs macOS with Xcode.
# The generated UniChef/ project is committed; review the diff after regenerating.
set -eu
cd "$(dirname "$0")"
pnpm --filter extensions build --target safari
xcrun safari-web-extension-converter ../common/dist/safari \
  --project-location . --app-name UniChef \
  --bundle-identifier io.github.0xdolan.unichef \
  --swift --copy-resources --no-open --no-prompt --force
