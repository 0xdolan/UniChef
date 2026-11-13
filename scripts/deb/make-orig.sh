#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Build the Debian orig tarball (PRD §8.3), or check debian/copyright.
#
#   scripts/deb/make-orig.sh [--ref REF] [--out DIR] [VERSION]
#   scripts/deb/make-orig.sh --check-copyright
#
# VERSION is SemVer and defaults to the VERSION file; REF defaults to the tag vVERSION.
# Writes DIR/unichef_<debian version>.orig.tar.gz (DIR defaults to build/deb). The tarball
# depends only on the tree, so every series and every rebuild gets the same bytes, which
# Launchpad requires. The same file is attached to GitHub Releases as unichef-<VERSION>.tar.gz.
set -euo pipefail
cd "$(dirname "$0")/../.."

die() { echo "make-orig: $*" >&2; exit 1; }

# The Unicode-3.0 stanza in debian/copyright must be the verbatim UCD licence.
check_copyright() {
  local ucd want got
  ucd=$(python3 -c 'import json; print(json.load(open("project.constants.json"))["UCD_VERSION"])')
  want=$(sed -e 's/[[:space:]]*$//' "data/ucd/$ucd/license.txt")
  got=$(awk '
    /^License: Unicode-3.0$/ && prev == "" { on = 1; next }
    on && /^$/ { exit }
    on { sub(/^ /, ""); if ($0 == ".") $0 = ""; print }
    { prev = $0 }' debian/copyright | sed -e 's/[[:space:]]*$//')
  [[ -n "$got" ]] || die "debian/copyright has no standalone License: Unicode-3.0 stanza."
  if grep -q '<verbatim' debian/copyright; then die "debian/copyright still has a placeholder."; fi
  [[ "$got" == "$want" ]] || die "the Unicode-3.0 text in debian/copyright differs from data/ucd/$ucd/license.txt."
  echo "make-orig: debian/copyright: ok"
}

# SemVer to the Debian upstream version (REL-001): 0.1.0-alpha.1 -> 0.1.0~alpha1.
debian_version() {
  local re='^([0-9]+\.[0-9]+\.[0-9]+)(-(alpha|beta|rc)\.([1-9][0-9]*))?$'
  [[ "$1" =~ $re ]] || die "'$1' is not X.Y.Z or X.Y.Z-(alpha|beta|rc).N."
  if [[ -n "${BASH_REMATCH[2]}" ]]; then
    echo "${BASH_REMATCH[1]}~${BASH_REMATCH[3]}${BASH_REMATCH[4]}"
  else
    echo "${BASH_REMATCH[1]}"
  fi
}

ref="" out="build/deb" version=""
while (($#)); do
  case "$1" in
    --check-copyright) check_copyright; exit 0 ;;
    --ref) ref="${2:?--ref needs a value}"; shift 2 ;;
    --out) out="${2:?--out needs a value}"; shift 2 ;;
    --debian-version) debian_version "${2:?--debian-version needs a value}"; exit 0 ;;
    -*) die "unknown option $1" ;;
    *) version="$1"; shift ;;
  esac
done
version="${version:-$(tr -d '[:space:]' < VERSION)}"
deb=$(debian_version "$version")
ref="${ref:-v$version}"
git rev-parse --verify -q "$ref^{commit}" > /dev/null || die "no such ref: $ref"

mkdir -p "$out"
tarball="$out/unichef_$deb.orig.tar.gz"
git archive --format=tar --prefix="unichef-$deb/" "$ref" -- . \
  ':(exclude)debian' ':(exclude)docker' \
  ':(exclude)clients/web' ':(exclude)clients/extensions' ':(exclude)clients/gnome/test' \
  ':(exclude)assets/docs' \
  ':(exclude).claude' \
  | gzip -n -9 > "$tarball"
echo "$tarball"
