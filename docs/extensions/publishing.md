# Publishing the browser extensions

`.github/workflows/extensions.yml` publishes to the **Chrome Web Store** (also used by Brave), **Microsoft Edge Add-ons** and **addons.mozilla.org**. A stable tag `vX.Y.Z` publishes to all three. A pre-release tag only builds, and you publish it by hand. Every publish job waits for a maintainer to approve it in the `store-publish` environment. The Edge job is skipped until the `EDGE_PRODUCT_ID` variable is set.

The release workflow attaches `unichef-chrome-<version>.zip`, `unichef-edge-<version>.zip` and `unichef-firefox-<version>.zip` to every GitHub Release. People who don't use the stores can load these unpacked. Each release also attaches `unichef-safari-xcode-<version>.zip`, the Safari Xcode project generated from that release's build. Safari is not in the App Store.

## One-time setup

### 1. The `store-publish` environment

This environment is already set up. The maintainer is its required reviewer, and only `v*` tags and the `main` and `develop` branches can deploy to it. To set it up again:

```sh
gh api -X PUT repos/0xdolan/unichef/environments/store-publish --input - <<'JSON'
{ "reviewers": [{ "type": "User", "id": 18519747 }],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
for p in 'tag:v*' 'branch:main' 'branch:develop'; do
  gh api -X POST repos/0xdolan/unichef/environments/store-publish/deployment-branch-policies \
    -f name="${p#*:}" -f type="${p%%:*}"
done
```

### 2. Chrome Web Store

The API can't create an item. The first upload and the listing are done in the dashboard.

1. Build the zip: `make build-ext`, which writes `clients/extensions/common/dist/unichef-chrome-<version>.zip`. You can also download it from a GitHub Release.
2. Go to <https://chrome.google.com/webstore/devconsole> and choose **New item**. Upload the zip.
3. Fill in the **Store listing** and **Privacy** tabs from `clients/extensions/chrome/store/listing.md`. `make assets` writes the images to `assets/branding/dist/store/`.
4. Submit this first version for review in the dashboard.
5. Note two IDs:
   - The **item ID**: the 32 letters in the item's URL.
   - The **publisher ID**: **Account** → **Publisher ID**.
6. Create a service account for the API:
   1. In <https://console.cloud.google.com>, create a project or choose an existing one.
   2. Enable the **Chrome Web Store API** under **APIs & Services** → **Library**.
   3. Go to **IAM & Admin** → **Service accounts** and choose **Create service account**. It needs no roles.
   4. Open the new account. Choose **Keys** → **Add key** → **JSON**. Save the file.
   5. In the Chrome Web Store dashboard, go to **Account** → **Service accounts** and add the service account's email address. A publisher can have only one service account.
7. Store the key and the IDs. Then delete the key file:

   ```sh
   gh secret set CWS_SERVICE_ACCOUNT -R 0xdolan/unichef --env store-publish < ~/Downloads/<key>.json
   gh variable set CWS_PUBLISHER_ID -R 0xdolan/unichef --body '<publisher id>'
   gh variable set CWS_EXTENSION_ID -R 0xdolan/unichef --body '<item id>'
   shred -u ~/Downloads/<key>.json
   ```

### 3. addons.mozilla.org

The first run creates the listing from `clients/extensions/firefox/store/amo-metadata.json` for the add-on ID `unichef@0xdolan.github.io`. There is no dashboard step first.

1. Go to <https://addons.mozilla.org/developers/addon/api/key/> and choose **Generate new credentials**.
2. Store them:

   ```sh
   gh secret set AMO_JWT_ISSUER -R 0xdolan/unichef --env store-publish   # paste the "JWT issuer"
   gh secret set AMO_JWT_SECRET -R 0xdolan/unichef --env store-publish   # paste the "JWT secret"
   ```

3. After the first submission, add the screenshots from `assets/branding/dist/store/` on the listing's **Edit Product Page**.

### 4. Microsoft Edge Add-ons

The API can't create a product. The first submission is done in Partner Center.

1. Register as a Microsoft Edge developer at <https://partner.microsoft.com/dashboard/microsoftedge/overview> (free).
2. Choose **Create new extension** and upload `unichef-edge-<version>.zip` (`make build-ext`, or from a GitHub Release).
3. Fill in **Properties**, **Availability** and **Store listings** from `clients/extensions/edge/store/listing.md`, then **Publish**.
4. Copy the **Product ID** from the extension's **Overview** page.
5. Go to **Publish API** and choose **Create API credentials**. Note the **Client ID** and the **API key**. The key expires after 72 days; create a new one and update the secret before then.
6. Store them:

   ```sh
   gh secret set EDGE_CLIENT_ID -R 0xdolan/unichef --env store-publish   # paste the Client ID
   gh secret set EDGE_API_KEY -R 0xdolan/unichef --env store-publish     # paste the API key
   gh variable set EDGE_PRODUCT_ID -R 0xdolan/unichef --body '<product id>'
   ```

## GNOME Shell extension

extensions.gnome.org has no upload API, so the maintainer uploads each stable release by hand:

1. Sign in at <https://extensions.gnome.org/upload/> (one-time: create the account).
2. Upload `unichef-gnome-<version>.zip` from the GitHub Release. Do not rebuild it: the zip is reproducible and attested, so reviewers and users can check it against the release.
3. Wait for review (often a few days). A rejection comes with comments; fix them on `develop` and ship them in the next release.

The site needs a higher `version` for each upload, and it assigns that number itself. `version-name` in `metadata.json` carries the UniChef version (`0.1.0 alpha.1`); `make version` sets it.

## Publishing a release

A stable tag publishes on its own. To publish a pre-release, or to retry a store run, start the workflow by hand:

```sh
gh workflow run extensions.yml -R 0xdolan/unichef -f ref=v0.1.0-alpha.1            # every store
gh workflow run extensions.yml -R 0xdolan/unichef -f ref=v0.1.0-alpha.1 -f store=firefox
gh workflow run extensions.yml -R 0xdolan/unichef -f ref=v0.1.0-alpha.1 -f staged=true
gh run watch -R 0xdolan/unichef "$(gh run list -R 0xdolan/unichef -w extensions.yml -L1 --json databaseId -q '.[0].databaseId')"
```

Approve the run when GitHub asks for a review. You can do this on the run page, or with `gh api` on `repos/0xdolan/unichef/actions/runs/<id>/pending_deployments`.

When `staged=true`, Chrome holds the version after review until you choose **Publish** in the dashboard. Each store upload needs a higher manifest `version` than the one before. `scripts/version/` derives it from `VERSION`.

Each store reviews every version. The job ends once a version is submitted, so check the dashboards for the review result.

## Installing without a store

- **Brave:** install from the Chrome Web Store.
- **Edge:** install from Edge Add-ons. Until that listing exists, open the Chrome Web Store listing and choose **Allow extensions from other stores**.
- **Unpacked (Chrome, Brave):** unzip `unichef-chrome-<version>.zip`. Open `chrome://extensions` and turn on **Developer mode**. Choose **Load unpacked** and select the unzipped folder.
- **Unpacked (Edge):** unzip `unichef-edge-<version>.zip`. Open `edge://extensions`, turn on **Developer mode**, choose **Load unpacked** and select the unzipped folder.
- **Firefox, temporary install:** open `about:debugging#/runtime/this-firefox` and choose **Load Temporary Add-on**. Select `manifest.json` in the unzipped `unichef-firefox-<version>.zip`. Release Firefox accepts only signed add-ons for a permanent install, so use the AMO listing for that.
- **Safari (macOS, Xcode 15 or later):**
  1. Unzip `unichef-safari-xcode-<version>.zip` and open `UniChef/UniChef.xcodeproj` in Xcode.
  2. Under **Signing & Capabilities**, pick your team for both the app and the extension targets. A free Apple ID works for local use.
  3. Choose the **UniChef (macOS)** scheme and **Run**. This installs the app that contains the extension.
  4. In Safari, open **Settings → Advanced** and turn on **Show features for web developers**. Then choose **Develop → Allow Unsigned Extensions**. Safari turns this off each time it quits.
  5. Open **Settings → Extensions** and turn on UniChef.

  To build it yourself instead, run `clients/extensions/safari/generate-xcode.sh` on a Mac. It writes the project to `clients/extensions/safari/UniChef/`, which git ignores.
