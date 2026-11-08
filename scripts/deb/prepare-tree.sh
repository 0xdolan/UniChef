#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Copy debian/ into an unpacked orig tree for one Ubuntu series (PRD §8.6).
#
#   scripts/deb/prepare-tree.sh SOURCE_DIR CODENAME
#
# debian/patches/series-CODENAME, if present, becomes that tree's quilt series. Patch
# files the series does not list are left out, so every series gets a clean source package.
set -euo pipefail
src="${1:?usage: prepare-tree.sh SOURCE_DIR CODENAME}"
codename="${2:?usage: prepare-tree.sh SOURCE_DIR CODENAME}"
repo="$(cd "$(dirname "$0")/../.." && pwd)"

cp -r "$repo/debian" "$src/"
patches="$src/debian/patches"
[[ -d "$patches" ]] || exit 0
if [[ -f "$patches/series-$codename" ]]; then
  mv "$patches/series-$codename" "$patches/series"
fi
rm -f "$patches"/series-*
if [[ ! -s "$patches/series" ]]; then
  rm -rf "$patches"
  exit 0
fi
for p in "$patches"/*; do
  name="${p##*/}"
  [[ "$name" == series ]] && continue
  grep -qxF "$name" "$patches/series" || rm -f "$p"
done
