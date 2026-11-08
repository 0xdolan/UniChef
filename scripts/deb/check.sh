#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Debian pre-flight (PRD §8.5): in a clean Ubuntu or Debian container, install the build
# dependencies, build the source and binary packages, run lintian and the autopkgtest.
#
#   make deb-check                     # ubuntu:24.04 (noble), via docker compose
#   SERIES=26.04 make deb-check        # another release
#   docker run --rm -v "$PWD:/src:ro" debian:trixie /src/scripts/deb/check.sh   # Debian 13
#
# Runs as root inside the container. The repository is mounted read-only; everything is
# built in a temporary directory.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  autopkgtest ca-certificates devscripts equivs git lintian python3 > /dev/null

repo="$(cd "$(dirname "$0")/../.." && pwd)"
git config --global --add safe.directory "$repo"
work=$(mktemp -d)
cd "$repo"
"$repo/scripts/deb/make-orig.sh" --check-copyright
deb=$("$repo/scripts/deb/make-orig.sh" --debian-version "$(tr -d '[:space:]' < VERSION)")
orig=$("$repo/scripts/deb/make-orig.sh" --ref HEAD --out "$work")
tar -xzf "$orig" -C "$work"
src="$work/unichef-$deb"
# shellcheck source=/dev/null
codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
distro=$(. /etc/os-release && echo "$ID")   # ubuntu or debian: the lintian profile
"$repo/scripts/deb/prepare-tree.sh" "$src" "$codename"
# Ubuntu's lintian profile rejects Debian's "unstable"; build for this release instead.
sed -i "1s/) [a-z-]*;/) $codename;/" "$src/debian/changelog"

cd "$src"
mk-build-deps --install --remove \
  --tool 'apt-get -y -qq --no-install-recommends -o Debug::pkgProblemResolver=yes' debian/control
dpkg-buildpackage -us -uc
cd "$work"
lintian --profile "$distro" --fail-on error,warning --info "$work"/unichef_*.changes
autopkgtest "$work"/unichef_*_all.deb "$src" -- null
echo "deb-check: ok"
