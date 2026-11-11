#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Build signed source packages for every series in debian/ppa-series.txt and upload them
# to the PPA (PRD §8.5).
#
#   GPG_KEY_ID=… scripts/deb/ppa-upload.sh [--ref REF] [--rev N] [--series CODENAME] [--dry-run]
#
# --rev N   the PPA revision, 1 for a new upstream version; raise it to re-upload one.
# --series  upload only this series from debian/ppa-series.txt.
# --dry-run builds and lints the source packages but does not sign or upload them.
# Needs devscripts, dput, lintian, debhelper, dh-python, pybuild-plugin-pyproject and
# bash-completion. The GPG key's UID e-mail must be the Maintainer in debian/control, and
# the key must be registered on the Launchpad profile.
set -euo pipefail
cd "$(dirname "$0")/../.."

die() { echo "ppa-upload: $*" >&2; exit 1; }

ref="" rev=1 only="" dry=false
while (($#)); do
  case "$1" in
    --ref) ref="${2:?--ref needs a value}"; shift 2 ;;
    --rev) rev="${2:?--rev needs a value}"; shift 2 ;;
    --series) only="${2:?--series needs a value}"; shift 2 ;;
    --dry-run) dry=true; shift ;;
    *) die "unknown option $1" ;;
  esac
done
[[ "$rev" =~ ^[1-9][0-9]*$ ]] || die "--rev must be a positive integer."
$dry || [[ -n "${GPG_KEY_ID:-}" ]] || die "GPG_KEY_ID is not set."

PPA=$(python3 -c 'import json; print(json.load(open("project.constants.json"))["PPA"])')
version=$(tr -d '[:space:]' < VERSION)
deb=$(scripts/deb/make-orig.sh --debian-version "$version")
scripts/deb/make-orig.sh --check-copyright

# The changelog signature must match the GPG key, so it comes from debian/control.
maintainer=$(sed -n 's/^Maintainer: //p' debian/control)
export DEBFULLNAME="${maintainer% <*}"
export DEBEMAIL="${maintainer##*<}"
DEBEMAIL="${DEBEMAIL%>}"

out="$PWD/build/deb"
rm -rf "$out"
orig=$(scripts/deb/make-orig.sh --out "$out" ${ref:+--ref "$ref"} "$version")

mapfile -t series < <(grep -v '^[[:space:]]*\(#\|$\)' debian/ppa-series.txt)
((${#series[@]})) || die "debian/ppa-series.txt lists no series."
if [[ -n "$only" ]]; then
  [[ " ${series[*]} " == *" $only "* ]] || die "$only is not in debian/ppa-series.txt."
  series=("$only")
fi

changes=()
for s in "${series[@]}"; do
  dir="$out/$s/unichef-$deb"
  mkdir -p "$out/$s"
  ln -f "$orig" "$out/$s/"
  tar -xzf "$orig" -C "$out/$s"
  scripts/deb/prepare-tree.sh "$dir" "$s"
  # ~ppa sorts below the committed -1 entry, so dch needs -b.
  ver="$deb-1~ppa$rev~${s}1"
  (cd "$dir" &&
    dch -b --newversion "$ver" --distribution "$s" --force-distribution "PPA build for $s." &&
    dpkg-buildpackage -S -sa -d -us -uc)
  lintian --profile ubuntu --fail-on error,warning "$out/$s/unichef_${ver}.dsc"
  changes+=("$out/$s/unichef_${ver}_source.changes")
done

if $dry; then
  printf 'ppa-upload: built (dry run, not signed or uploaded):\n'
  printf '  %s\n' "${changes[@]}"
  exit 0
fi
for c in "${changes[@]}"; do
  debsign -k "$GPG_KEY_ID" "$c"
  dput "$PPA" "$c"
done
