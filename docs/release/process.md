# Release process

How a UniChef version goes from `develop` to users, and the quality gates on the way. The
branch model is in [CONTRIBUTING.md](../../CONTRIBUTING.md). The manual checks are in
[qa-checklist.md](qa-checklist.md).

## 1. Gates

A release passes three kinds of gate. Automate a check when you can; keep a manual one only
for what a machine cannot judge (real devices, store dialogs, how something looks).

| Gate | When | What it checks | Where |
|---|---|---|---|
| **CI** | Every pull request | Lint, types, unit and parity tests, UCD and op checks, traceability (every PRD ID has a test), bundle budgets, Python on Linux, macOS and Windows (x64 and arm64), `.deb` build with lintian and autopkgtest on noble, resolute and trixie, extension schema and `web-ext lint`, the Safari Xcode project built unsigned on macOS, e2e on desktop Chromium, Firefox and WebKit plus Pixel 7 and iPhone 15 profiles with axe WCAG 2.2 AA scans | `ci.yml`, `make ci` |
| **Release build** | Tag push | The tag is SemVer, signed, verified and equals `VERSION`; a stable tag is on `main`; every file agrees with `VERSION`; the release notes come from `CHANGELOG.md`; every artefact is attested | `release.yml` |
| **Release verify** | After the release is published | Every asset is attached, `SHA256SUMS` matches, every artefact and the image have valid provenance, and PyPI, npm and GHCR serve the version | `verify-release` job, `make release-verify V=…` |
| **Manual QA** | Each release candidate | Real browsers and phones, store installs, Launchpad, clean-machine installs | [qa-checklist.md](qa-checklist.md) |

A failed gate blocks the release. A failed manual item becomes an issue; a `priority:high` one
blocks.

## 2. Artefacts

Every release has all of these. `scripts/release/verify.sh` fails if one is missing.

| Artefact | File or location | Built by | Attested |
|---|---|---|---|
| Python wheel and sdist | `unichef-<pep440>-py3-none-any.whl`, `unichef-<pep440>.tar.gz`; PyPI | `build-all`, `pypi` (trusted publishing) | Yes, and PyPI attestations |
| npm package | `unichef-core-<v>.tgz`; npm `@unichef/core` | `build-all`, `npm` (trusted publishing, provenance) | Yes |
| Debian packages | `unichef_<deb>-1~<series>1_all.deb` and `gnome-shell-extension-unichef_<deb>-1~<series>1_all.deb` for noble, resolute and trixie | `deb` (lintian and autopkgtest pass first) | Yes |
| Ubuntu PPA | `ppa:0xdolan/unichef`, every series in `debian/ppa-series.txt` | `ppa.yml` (signed source upload, approval in `ppa-publish`) | Launchpad signs |
| Source tarball | `unichef-<v>.tar.gz` (the Debian orig) | `build-all` | Yes |
| Browser extensions | `unichef-chrome-<v>.zip` (Chrome, Brave), `unichef-edge-<v>.zip`, `unichef-firefox-<v>.zip`; Chrome Web Store, Edge Add-ons and AMO on stable tags | `build-all`, `extensions.yml` (approval in `store-publish`) | Yes |
| GNOME Shell extension | `unichef-gnome-<v>.zip` (reproducible); extensions.gnome.org by hand on stable tags (it has no upload API) | `build-all` | Yes |
| Safari Xcode project | `unichef-safari-xcode-<v>.zip` (unsigned; build it in Xcode, no App Store) | `safari` on `macos-latest` (it must build unsigned first) | Yes |
| Web app | `unichef-web-<v>.zip` (serve under `/unichef/`); GitHub Pages from `main` | `build-all`, `pages.yml` | Yes |
| Container | `ghcr.io/0xdolan/unichef:<v>`, and `latest` for stable tags; amd64 and arm64 | `ghcr` (BuildKit SBOM and provenance) | Yes, pushed to the registry |
| SBOMs | `unichef-python.cdx.json`, `unichef-core-npm.cdx.json` (CycloneDX) | `build-all` | No |
| Checksums | `SHA256SUMS` over every file above | `build-all` | No |
| Release notes | The `## [<v>]` section of `CHANGELOG.md` | `github-release` | n/a |

Users verify a download with:

```sh
sha256sum -c --ignore-missing SHA256SUMS
gh attestation verify unichef-web-<v>.zip -R 0xdolan/unichef
gh attestation verify oci://ghcr.io/0xdolan/unichef:<v> -R 0xdolan/unichef
```

## 3. Steps

Versions are SemVer: `X.Y.Z-alpha.N`, then `-beta.N`, then `-rc.N`, then `X.Y.Z`. Python
spells them in PEP 440 (`1.0.0rc1`), which `make version` handles.

1. **Freeze.** On `develop`, check that the milestone has no open `priority:high` issue and
   that CI is green.
2. **Branch.** `git switch -c release/X.Y.Z develop`.
3. **Version.** `make version V=X.Y.Z-rc.1` sets every file and moves the `[Unreleased]`
   changelog entries under the new heading. Review `CHANGELOG.md`; it becomes the release
   notes. Commit as `chore(release): X.Y.Z-rc.1`.
4. **Pre-flight.** `make ci` locally (or `make docker-ci`), then open the pull request into
   `main`. Fixes only on this branch from now on.
5. **Tag.** The maintainer tags and pushes from their own machine, because the tag must be
   signed with their key:
   `git tag -s vX.Y.Z-rc.1 -m "UniChef X.Y.Z-rc.1" && git push origin vX.Y.Z-rc.1`.
   A pre-release tag may be on the release branch; a stable tag must be on `main`.
6. **Watch.** `release.yml` builds, attests and publishes, then `verify-release` checks the
   result. Approve `ppa.yml` and, for stable tags, `extensions.yml` in their environments.
7. **QA.** Copy [qa-checklist.md](qa-checklist.md) into the RC's tracking issue and work
   through it against the published artefacts.
8. **Iterate or ship.** A fix goes into `release/X.Y.Z` and the next tag is `-rc.2`. When an
   RC passes and the soak period is over, run `make version V=X.Y.Z`, merge the release pull
   request into `main` with a merge commit, tag `vX.Y.Z` on `main`, and merge `main` back into
   `develop`.

## 4. After a release

- Upload `assets/branding/dist/github/social-preview.png` under **Settings → General → Social
  preview** if the brand changed. GitHub has no API for it.
- For a stable tag, upload `unichef-gnome-<v>.zip` from the release at
  <https://extensions.gnome.org/upload/>. Review there takes days, and there is no API.
- Close the RC tracking issue with the versions tested.
- If something must be pulled: yank on PyPI, `npm deprecate`, delete the GHCR tag, and mark
  the GitHub Release as a pre-release with a notice. Never reuse a version number.
