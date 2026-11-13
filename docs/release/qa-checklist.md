# Release QA checklist

Manual QA for each release candidate, as the M3 exit criteria require (PRD §15). Copy this list into
the RC's tracking issue and tick each item. Any failure becomes an issue. A `priority:high`
failure blocks the release.

CI and the `verify-release` job have already checked everything a machine can (see
[process.md](process.md) §1), including that every artefact is attached, checksummed and
attested. This list covers the rest. Test the artefacts attached to the GitHub Release for the
RC, not a local build. If there is no
release yet, `make build-ext` writes the same zips to `clients/extensions/common/dist/`.

Test string, pasted where a step says *sample*:

```text
Héllo ‮abc‬ ​ мир 👩🏽‍💻 ﷺ
```

It contains a precomposed letter, a bidi override, a zero-width space, Cyrillic text, a ZWJ emoji
sequence with a skin tone modifier, and an Arabic ligature.

## 1. Browser extensions

Run sections 1.1 to 1.6 in each browser. Write down the browser version you tested.

The `extension` e2e project (`clients/web/e2e/extension.spec.ts`) already runs these in
Chromium on every pull request: the permissions, the menu item being registered, a selection
reaching the open panel and updating it live, the cut notice, Recipe, Characters and the popup
working offline with no outside requests or console errors, and settings applying, persisting
and refusing an out-of-range limit. In Chrome, check those items quickly. What a machine cannot
do is right-click a real page and open the side panel from the menu, so do 1.2 by hand in every
browser, and run the whole list in Brave, Edge and Firefox.

| Browser | How to load it |
| ------- | -------------- |
| Chrome (116 or later) | `chrome://extensions` → Developer mode → **Load unpacked** → the unzipped `unichef-chrome-<v>.zip` |
| Brave | `brave://extensions`, then the same steps and zip as Chrome |
| Edge | `edge://extensions` → Developer mode → **Load unpacked** → the unzipped `unichef-edge-<v>.zip` |
| Firefox (128 or later) | `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `manifest.json` in the unzipped `unichef-firefox-<v>.zip` |
| Safari (17 or later, on a Mac) | Unzip `unichef-safari-xcode-<v>.zip`, then follow the Safari steps in [docs/extensions/publishing.md](../extensions/publishing.md#installing-without-a-store). Safari opens a popup instead of a side panel. |

### 1.1 Install

- [ ] It installs with no errors or warnings on the extensions page.
- [ ] The only permissions it asks for are context menus, storage and the side panel (Firefox:
      menus). It asks for no host or "read your data on all sites" permission.
- [ ] The toolbar shows the UniChef icon, and its tooltip reads "UniChef".

### 1.2 Context menu

- [ ] On any web page, select the *sample* and right-click it. The menu has **Inspect with UniChef**.
- [ ] Choose it. Chrome, Brave and Edge open the side panel. Firefox opens the sidebar.
- [ ] The Inspect tab shows the selection.
- [ ] With the panel still open, select different text and choose the menu item again. The panel
      updates without being reopened.
- [ ] The menu item does not appear when no text is selected.
- [ ] Select more than the selection limit (100 000 characters by default), for example a large
      page with Ctrl+A. The panel receives only the first 100 000 characters, with no emoji
      split in half, stays responsive, and says that the selection was cut.

### 1.3 Panel tabs

- [ ] **Inspect:** each character of the *sample* is listed with its code point, name, script and
      category. The bidi override and the zero-width space are flagged, and so is the mixed-script
      word. The emoji is one grapheme in grapheme mode.
- [ ] **Quick Recipe:** pick an operation such as To Hex or NFC normalise. The output updates as
      you type. An invalid argument shows an error message, not a blank output.
- [ ] **Char Lookup:** search `arabic ligature`, then open U+FDFA. The detail view shows its
      properties, and a link back returns to the list.
- [ ] Every tab works with the keyboard alone: Tab, Shift+Tab, Enter and the arrow keys in lists.
      Focus is always visible.

### 1.4 Popup

- [ ] Click the toolbar icon. The popup opens with the same tabs.
- [ ] Text pasted into the popup can be inspected.

### 1.5 Settings

- [ ] Change the theme to light, dark and system. The panel and popup follow the change straight
      away, and system follows the OS setting.
- [ ] Change the default tab. A newly opened panel starts on it.
- [ ] Change the selection limit. Values outside 1 000–1 000 000 are refused.
- [ ] Settings survive a browser restart. Chrome, Brave and Edge also sync them through
      `storage.sync` when you are signed in.

### 1.6 Privacy and offline

- [ ] Open the panel's devtools (right-click the panel → Inspect) and go to the Network tab. Use
      every tab. You see no requests except `chrome-extension://` or `moz-extension://` URLs.
- [ ] Turn the network off and repeat 1.2 and 1.3. Everything still works.
- [ ] The console shows no errors or CSP violations.

### 1.7 Lint (once per RC)

- [ ] `npx web-ext lint -s clients/extensions/common/dist/firefox` reports no errors.
- [ ] Chrome's extensions page shows no **Errors** button for UniChef.

## 2. Web app

Use the Pages build: <https://0xdolan.github.io/unichef/>.

- [ ] Every route loads: Workbench, Characters, a character page, Blocks, Scripts, Regex,
      Playground, Recipes and About.
- [ ] **Workbench:** build To Hex → From Hex. The output equals the *sample*. Reload the page
      and the recipe is still there.
- [ ] **Share:** copy the share link and open it in a private window. The same recipe and input
      load.
- [ ] **CyberChef import:** paste `[{"op":"To Base64","args":["A-Za-z0-9+/="]},{"op":"CRC Checksum","args":["CRC-32"]}]`.
      Both steps import. Change `CRC-32` to `CRC-16/ARC` and the import is refused with a clear
      error message.
- [ ] Turn the network off after the first load and reload the page. The app still works (it is
      offline-capable).
- [ ] The Network tab shows requests only to `0xdolan.github.io`.
- [ ] On a real phone (Android Chrome and iOS Safari), open the site. The header shows the logo
      and a **Menu** button, the menu opens and closes, and nothing scrolls sideways. Tapping a
      field does not zoom the page. The `mobile-chrome` and `mobile-safari` e2e projects already
      check this in CI; this step covers what emulation misses.
- [ ] Install it (Android: **Install app**; iOS: Share → **Add to Home Screen**). The home screen
      shows the UniChef icon with no white border, and the app opens without browser chrome.
- [ ] Light and dark themes both pass a contrast check (Lighthouse accessibility score of 95 or
      more).

## 3. Command line

Install each way on a clean machine or in a container. After each install, run the smoke test.

| Channel | Install command |
| ------- | --------------- |
| PyPI | `pipx install unichef==<v>` or `uv tool install unichef==<v>` |
| PPA (Ubuntu 24.04 and 26.04) | `sudo add-apt-repository ppa:0xdolan/unichef && sudo apt install unichef` |
| Container | `docker run --rm -i ghcr.io/0xdolan/unichef:<v> unichef version` |
| npm library | `npm i @unichef/core@<v>` in an empty project, then import it |

Smoke test:

```sh
unichef version                          # shows <v> and the UCD version
echo 'Héllo мир' | unichef inspect       # one row per character
unichef char U+FDFA                      # ARABIC LIGATURE SALLALLAHOU ALAYHE WASALLAM
unichef op to-hex 'A'                    # 41
printf 'a‮b' > /tmp/t.txt && unichef scan --fail-on bidi /tmp/t.txt; echo "exit $?"   # non-zero
unichef completion bash | head -1        # prints a completion script
man unichef                              # PPA only: the man page opens
```

- [ ] PyPI install and smoke test.
- [ ] PPA: Launchpad shows every series in `debian/ppa-series.txt` built and published.
- [ ] PPA install and smoke test, on noble and on resolute.
- [ ] Container smoke test.
- [ ] npm: `import { bake } from '@unichef/core'` runs a recipe in Node 22 or later.

## 4. GNOME Shell extension

A real session is needed: the popup, the panel icon and the clipboard can only be judged on a
desktop. CI checks the metadata, the zip contents and the CLI calls (`FR-016` tests).

Install it from the PPA (`sudo apt install gnome-shell-extension-unichef`) on noble or resolute, or install the CLI (section 3) and then:
`gnome-extensions install --force unichef-gnome-<v>.zip`, log out and in, and
`gnome-extensions enable unichef@0xdolan.github.io`.

- [ ] The UniChef icon appears in the top bar, in the light and the dark style.
- [ ] **Convert:** type `base` in the search, choose From Base64 and type `SGVsbG8=`. The output
      is `Hello`. **Copy output** puts it on the clipboard.
- [ ] **Paste clipboard** fills the input and runs the operation.
- [ ] **Character:** type `é👋🏽`. The list shows U+00E9, U+1F44B and U+1F3FD with their names.
      **Copy as U+…** and **Copy as \u…** copy the code points.
- [ ] **Open the full UniChef web app** opens the Pages site in the browser.
- [ ] With `unichef` removed from `PATH`, the popup shows the install hint instead of failing.
- [ ] `journalctl --user -b | grep -i unichef` shows no errors after enabling, using and
      disabling the extension.

## 5. Sign-off

- [ ] Every box above is ticked, or has an issue linked next to it.
- [ ] No `priority:high` issue is open in the milestone.
- [ ] Record the RC version, the date and the browser versions in the tracking issue, then close
      it.
