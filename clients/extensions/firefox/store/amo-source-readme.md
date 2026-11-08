# Building the UniChef Firefox add-on from source

This note is for AMO reviewers. The uploaded source archive is `git archive` of the release tag; the add-on is built from it with the commands below. The build is reproducible: the same source gives a byte-identical `unichef-firefox-<version>.zip`.

## With Docker (recommended)

The dev image has every tool the build needs (Node 24, pnpm, uv, rsvg-convert, ImageMagick and oxipng):

```sh
docker build --target dev -f docker/Dev.Dockerfile -t unichef-dev .
docker run --rm -v "$PWD:/src" -w /src unichef-dev sh -c \
  'pnpm install --frozen-lockfile && make build-ext'
```

## Without Docker

Needs Node 24 with corepack, uv (https://docs.astral.sh/uv/), and `rsvg-convert` (librsvg), ImageMagick and oxipng on PATH. On Ubuntu 24.04:

```sh
sudo apt-get install -y librsvg2-bin imagemagick
scripts/assets/install-oxipng.sh "$HOME/.local/bin"   # checksum-verified oxipng 10.2.1
corepack enable
pnpm install --frozen-lockfile
uv run scripts/assets/build.py --only ext/            # the icons, from the SVG masters
pnpm --filter extensions build --target firefox
```

## Output

- `clients/extensions/common/dist/firefox/`: the unpacked add-on.
- `clients/extensions/common/dist/unichef-firefox-<version>.zip`: the submitted package.

## What the build does

`clients/extensions/common/build/build.ts` builds the web app's `extension.html` entry with Vite, bundles `src/background.ts` into `background.js`, merges `manifest.base.json` with `overlays/firefox.json`, copies the icons and runs `web-ext lint`. No code is downloaded or generated at build time other than this bundling, and nothing is minified beyond Vite's standard production build. All dependencies are pinned in `pnpm-lock.yaml`.
