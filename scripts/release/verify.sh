#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Check a published release from the outside, as a user would get it (docs/release/process.md):
# every expected asset is attached, SHA256SUMS matches, each artefact has a GitHub build
# provenance attestation, and the version is live on PyPI, npm and GHCR.
#
#   make release-verify V=1.0.0-rc.1
#   scripts/release/verify.sh 1.0.0-rc.1 [--skip-registries]
#
# Needs gh (signed in), curl and sha256sum; docker is optional (image check skipped without).
set -euo pipefail

REPO=0xdolan/unichef
v="${1:?usage: verify.sh VERSION [--skip-registries]}"
v="${v#v}"
registries=1
[[ "${2:-}" == --skip-registries ]] && registries=0

fail=0
ok() { printf '  ok    %s\n' "$*"; }
bad() { printf '  FAIL  %s\n' "$*"; fail=1; }
# check OK_TEXT FAIL_TEXT COMMAND...: report whether COMMAND succeeds.
check() {
  local good="$1" fault="$2"
  shift 2
  if "$@" > /dev/null 2>&1; then ok "$good"; else bad "$fault"; fi
}

# PEP 440 spelling of the SemVer tag: 1.0.0-rc.1 -> 1.0.0rc1, 0.1.0-alpha.2 -> 0.1.0a2.
py=$(sed -E 's/-alpha\./a/; s/-beta\./b/; s/-rc\./rc/' <<< "$v")

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
echo "Release v$v"
gh release download "v$v" -R "$REPO" -D "$work" > /dev/null

echo "Assets"
expected=(
  "unichef-$py-py3-none-any.whl"
  "unichef-$py.tar.gz"
  "unichef-core-$v.tgz"
  "unichef-chrome-$v.zip"
  "unichef-edge-$v.zip"
  "unichef-firefox-$v.zip"
  "unichef-gnome-$v.zip"
  "unichef-safari-xcode-$v.zip"
  "unichef-web-$v.zip"
  "unichef-$v.tar.gz"
  "unichef-python.cdx.json"
  "unichef-core-npm.cdx.json"
  "SHA256SUMS"
)
for f in "${expected[@]}"; do
  check "$f" "$f is missing" test -f "$work/$f"
done
for series in noble resolute trixie; do
  deb=$(find "$work" -maxdepth 1 -name "unichef_*~${series}1_all.deb" -printf '%f\n' | head -1)
  check "${deb:-$series}" ".deb for $series is missing" test -n "$deb"
done

echo "Checksums"
if [[ -f "$work/SHA256SUMS" ]]; then
  # SHA256SUMS lists paths under dist/; release assets are flat.
  if (cd "$work" && sed -E 's#  .*/#  #' SHA256SUMS | sha256sum --quiet -c -); then
    ok "SHA256SUMS matches every asset"
  else
    bad "SHA256SUMS does not match"
  fi
fi

echo "Provenance"
while IFS= read -r f; do
  check "$f" "$f has no valid attestation" gh attestation verify "$work/$f" -R "$REPO"
done < <(find "$work" -maxdepth 1 -type f \( -name '*.whl' -o -name '*.tar.gz' -o -name '*.tgz' \
  -o -name '*.zip' -o -name '*.deb' \) -printf '%f\n' | sort)

if ((registries)); then
  echo "Registries"
  check "PyPI unichef $py" "PyPI has no unichef $py" \
    curl -fsS "https://pypi.org/pypi/unichef/$py/json"
  check "npm @unichef/core $v" "npm has no @unichef/core $v" \
    curl -fsS "https://registry.npmjs.org/@unichef%2Fcore/$v"
  if command -v docker > /dev/null; then
    check "ghcr.io/$REPO:$v" "ghcr.io/$REPO:$v is not pullable" \
      docker manifest inspect "ghcr.io/$REPO:$v"
    check "image attestation" "the image has no valid attestation" \
      gh attestation verify "oci://ghcr.io/$REPO:$v" -R "$REPO"
  else
    echo "  skip  GHCR (no docker)"
  fi
fi

((fail)) && { echo "release-verify: FAILED"; exit 1; }
echo "release-verify: ok"
