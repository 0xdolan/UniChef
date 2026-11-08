# Debian package and Launchpad PPA

UniChef ships a Debian source package from `debian/` (PRD §8). Each release tag uploads it to
the PPA [`ppa:0xdolan/unichef`](https://launchpad.net/~0xdolan/+archive/ubuntu/unichef), once per
Ubuntu series in `debian/ppa-series.txt`. Launchpad then builds the `.deb`s.

```sh
sudo add-apt-repository ppa:0xdolan/unichef
sudo apt install unichef
```

## Checking the package locally

```sh
make deb-check                 # ubuntu:24.04 (noble)
SERIES=26.04 make deb-check    # ubuntu:26.04 (resolute)
```

The check builds the orig tarball from `HEAD` and builds the binary package in a clean
container. It then runs lintian (Ubuntu profile, failing on warnings) and the autopkgtest.
CI runs the same check for every series.

`scripts/deb/ppa-upload.sh --dry-run` builds and lints the source packages for every series.
It does not sign or upload them.

## Versions

| Upstream (SemVer) | Debian upstream | PPA upload for noble     |
| ----------------- | --------------- | ------------------------ |
| `0.1.0-alpha.1`   | `0.1.0~alpha1`  | `0.1.0~alpha1-1~ppa1~noble1` |
| `1.0.0`           | `1.0.0`         | `1.0.0-1~ppa1~noble1`    |

`make version V=…` updates the top entry of `debian/changelog`. For release notes, add a new
entry with `dch -v <debian version>-1` before tagging. The PPA suffix is added at upload time
and is never committed. To upload the same version again, run the workflow with a higher
revision:

```sh
gh workflow run ppa.yml -R 0xdolan/unichef -f ref=v0.1.0-alpha.1 -f rev=2
```

## Adding or dropping a series

1. Edit `UBUNTU_SERIES` in `project.constants.json` and `debian/ppa-series.txt`.
   `make version-check` fails if the two disagree.
2. Update the `deb` matrix in `.github/workflows/ci.yml`.
3. If a series needs changes, put its quilt series file in `debian/patches/series-<codename>`.
   It replaces `debian/patches/series` for that upload only.

## One-time setup (maintainer)

1. **Launchpad account and key.** Sign the Ubuntu Code of Conduct on your Launchpad profile.
   The signing key is `5029862C2AFFDBCA` (`Dolan <0xdolan@gmail.com>`, valid until
   2027-10-27), and it is already active on the profile. For a new key, publish it first and then
   register it:

   ```sh
   gpg --keyserver keyserver.ubuntu.com --send-keys <KEY_ID>
   gpg --fingerprint <KEY_ID>   # paste the fingerprint at https://launchpad.net/~/+editpgpkeys
   ```

   Launchpad e-mails you an encrypted message. Decrypt it with `gpg -d` and open the link
   inside it. The key's UID must include `0xdolan@gmail.com`, the `Maintainer` in
   `debian/control`. Extend the key's expiry before 2027-10-27 (`gpg --quick-set-expire`),
   then send it to the key server again.

2. **Create the PPA** at <https://launchpad.net/~0xdolan/+activate-ppa> with the name
   `unichef`.

3. **Environment and secrets.** Create the `ppa-publish` environment. Only you can approve
   it. Release tags, `main` and `develop` can deploy to it. Then add the secrets:

   ```sh
   gh api -X PUT repos/0xdolan/unichef/environments/ppa-publish --input - <<'JSON'
   {"reviewers":[{"type":"User","id":18519747}],
    "deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
   JSON
   for p in 'tag:v*' branch:main branch:develop; do   # branches allow manual re-uploads
     gh api -X POST repos/0xdolan/unichef/environments/ppa-publish/deployment-branch-policies \
       -f name="${p#*:}" -f type="${p%%:*}"
   done
   gpg --armor --export-secret-keys 5029862C2AFFDBCA \
     | gh secret set PPA_GPG_PRIVATE_KEY -R 0xdolan/unichef --env ppa-publish
   gh secret set PPA_GPG_PASSPHRASE -R 0xdolan/unichef --env ppa-publish   # prompts
   gh secret set GPG_KEY_ID -R 0xdolan/unichef --env ppa-publish --body 5029862C2AFFDBCA
   ```

   A signing subkey is safer in CI than the primary key. To use one, export only that
   subkey with `gpg --armor --export-secret-subkeys <SUBKEY_ID>!` and set `GPG_KEY_ID` to
   `<SUBKEY_ID>`.

4. **Upload.** The next release tag triggers `ppa.yml`. The upload job waits for your
   approval in the `ppa-publish` environment.
