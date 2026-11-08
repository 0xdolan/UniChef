# Chrome Web Store listing

Paste these into the Developer Dashboard. Brave and Edge users install from the Chrome Web Store too, so there is no separate Edge listing.

## Store listing

- **Name:** UniChef (from `_locales/en/messages.json`)
- **Summary:** taken from the manifest's `description`.
- **Category:** Developer Tools
- **Language:** English
- **Description:**

  > UniChef shows what a piece of text is really made of. Select text on any page, right-click and choose "Inspect with UniChef" to see every code point with its name, general category and script, and invisible and bidirectional control characters listed first.
  >
  > The side panel also runs UniChef recipes (encode, decode, normalise, escape and more) and has a character browser. Everything runs inside the extension: no text leaves your browser, nothing is collected and the extension asks for no access to the pages you visit.
  >
  > Source code and issue tracker: https://github.com/0xdolan/unichef

- **Images** (`make assets` writes them to `assets/branding/dist/store/`):
  - Store icon: `assets/branding/dist/ext/128.png`
  - Small promo tile (440×280): `chrome-promo-small.png`
  - Marquee (1400×560): `chrome-marquee.png`
  - Screenshots (1280×800): `screenshot-inspector.png`, `screenshot-recipes.png`, `screenshot-chars.png`, `screenshot-regex.png`, `screenshot-workbench.png`
- **Homepage:** https://0xdolan.github.io/unichef/
- **Support:** https://github.com/0xdolan/unichef/issues

## Privacy practices

- **Single purpose:** Inspect and transform text the user selects or types, character by character.
- **Permission justifications:**
  - `contextMenus`: adds "Inspect with UniChef" to the menu shown on a text selection. Clicking it passes that selection, and nothing else, to the extension.
  - `storage`: keeps the user's settings (theme, default tab, selection limit) in `storage.sync`, and hands the clicked selection to the panel through `storage.session`.
  - `sidePanel`: opens the UniChef panel beside the page.
- **Remote code:** No. All code is in the package; the content security policy is `script-src 'self'`.
- **Data usage:** collects no user data. Tick none of the data types, and certify all three statements (no selling, no unrelated use, no creditworthiness use).
- **Privacy policy:** https://github.com/0xdolan/unichef/blob/main/PRIVACY.md

## Distribution

- **Visibility:** Public.
- **Regions:** All regions.
