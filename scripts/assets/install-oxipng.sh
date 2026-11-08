#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Install the pinned oxipng release (PRD §9.2, §11.7), checking its SHA-256. oxipng is
# not in the Ubuntu 24.04 archive. Used by docker/Dev.Dockerfile and the CI extensions job.
#
#     scripts/assets/install-oxipng.sh [DIR]   # default /usr/local/bin
set -eu

VERSION=10.2.1
dest=${1:-/usr/local/bin}

case "$(uname -m)" in
  x86_64)
    arch=x86_64-unknown-linux-musl
    sum=1813750ef592c5350ca79c88f98b2c0876d05c826dc7156245256d4255c1ad17
    ;;
  aarch64)
    arch=aarch64-unknown-linux-musl
    sum=ff21aa2a005b324c8dfbdf13cd2f469fb6728b27dacded82635824ecd12e3b35
    ;;
  *)
    echo "install-oxipng: no oxipng build for $(uname -m)" >&2
    exit 1
    ;;
esac

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSLo "$tmp/oxipng.tgz" \
  "https://github.com/shssoichiro/oxipng/releases/download/v${VERSION}/oxipng-${VERSION}-${arch}.tar.gz"
echo "${sum}  $tmp/oxipng.tgz" | sha256sum -c -
mkdir -p "$dest"
tar -xzf "$tmp/oxipng.tgz" -C "$dest" --strip-components=1 "oxipng-${VERSION}-${arch}/oxipng"
"$dest/oxipng" --version
