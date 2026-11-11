#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Generate the Safari Web Extension Xcode project (PRD §7.7). Needs macOS with Xcode.
#
#   generate-xcode.sh [--no-build] [--out DIR]
#
#   --no-build  use the existing clients/extensions/common/dist/safari (CI downloads it)
#   --out DIR   where to write the UniChef/ project (default: this directory)
#
# The project copies the extension's files (--copy-resources), so it builds on its own.
# CI regenerates it from each build and checks that it builds unsigned; each release
# attaches it as unichef-safari-xcode-<v>.zip. Local builds land in UniChef/, which is
# git-ignored because its copied resources go stale as soon as the extension changes.
set -eu
cd "$(dirname "$0")"

build=1
out=.
while [ $# -gt 0 ]; do
  case "$1" in
    --no-build) build=0 ;;
    --out) out="${2:?--out needs a directory}"; shift ;;
    *) echo "usage: generate-xcode.sh [--no-build] [--out DIR]" >&2; exit 2 ;;
  esac
  shift
done

dist=../common/dist/safari
if [ "$build" -eq 1 ]; then
  pnpm --filter extensions build --target safari
fi
[ -f "$dist/manifest.json" ] || { echo "no Safari build in $dist" >&2; exit 1; }

mkdir -p "$out"
xcrun safari-web-extension-converter "$dist" \
  --project-location "$out" --app-name UniChef \
  --bundle-identifier io.github.0xdolan.unichef \
  --swift --copy-resources --no-open --no-prompt --force
