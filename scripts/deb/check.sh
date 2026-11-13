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
#
# With --out DIR (release.yml), the package is versioned for the container's series the way
# the PPA does it (<version>-1~<codename>1), and the tested .deb is copied to DIR.
set -euo pipefail

out=""
if [[ "${1:-}" == --out ]]; then
  out="${2:?--out needs a directory}"
  mkdir -p "$out"
  out="$(cd "$out" && pwd)"
fi

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
# shellcheck source=/dev/null
distro=$(. /etc/os-release && echo "$ID")   # ubuntu or debian: the lintian profile
"$repo/scripts/deb/prepare-tree.sh" "$src" "$codename"
# Ubuntu's lintian profile rejects Debian's "unstable"; build for this release instead.
sed -i "1s/) [a-z-]*;/) $codename;/" "$src/debian/changelog"
if [[ -n "$out" ]]; then
  # The maintainer from debian/control signs the entry, as in ppa-upload.sh.
  maintainer=$(sed -n 's/^Maintainer: //p' "$src/debian/control")
  email="${maintainer##*<}"
  (cd "$src" && DEBFULLNAME="${maintainer% <*}" DEBEMAIL="${email%>}" \
    dch -b --newversion "$deb-1~${codename}1" --distribution "$codename" \
    --force-distribution "Release build for $codename.")
fi

cd "$src"
mk-build-deps --install --remove \
  --tool 'apt-get -y -qq --no-install-recommends -o Debug::pkgProblemResolver=yes' debian/control
dpkg-buildpackage -us -uc
cd "$work"
lintian --profile "$distro" --fail-on error,warning --info "$work"/unichef_*.changes
autopkgtest "$work"/unichef_*_all.deb "$src" -- null
# FR-016: the extension package holds the extension where GNOME Shell looks for it. Its
# autopkgtest would have to install all of gnome-shell, so check the contents instead.
ext=/usr/share/gnome-shell/extensions/unichef@0xdolan.github.io
listing=$(dpkg-deb -c "$work"/gnome-shell-extension-unichef_*_all.deb)
for f in extension.js lib.js metadata.json stylesheet.css icons/unichef-symbolic.svg; do
  grep -q " \.$ext/$f\$" <<< "$listing" || { echo "deb-check: $ext/$f is missing" >&2; exit 1; }
done
dpkg-deb --fsys-tarfile "$work"/gnome-shell-extension-unichef_*_all.deb \
  | tar -xO ".$ext/metadata.json" \
  | python3 -c 'import json, sys; assert json.load(sys.stdin)["uuid"] == "unichef@0xdolan.github.io"'
[[ -z "$out" ]] || cp "$work"/unichef_*_all.deb "$work"/gnome-shell-extension-unichef_*_all.deb "$out/"
echo "deb-check: ok"
