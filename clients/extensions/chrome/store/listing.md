# Chrome Web Store listing

Paste these into the Developer Dashboard. Brave users install from the Chrome Web Store too. Edge has its own listing in `../../edge/store/listing.md`.

## Store listing

- **Name:** UniChef (from `_locales/en/messages.json`)
- **Summary:** taken from the manifest's `description`.
- **Category:** Developer Tools
- **Language:** English
- **Description:**

  > UniChef is a cybersecurity and Unicode workbench in your browser. Select text on any page, right-click and choose "Inspect with UniChef" to see every code point with its name, general category and script, with invisible and bidirectional control characters listed first: the tricks behind Trojan Source, homoglyph domains and hidden text.
  >
  > The side panel runs UniChef recipes: decode Base64, hex or URL encoding, hash with SHA-2, SHA-3 or BLAKE2, decrypt AES, decode a JWT, gunzip, normalise Unicode and more, chained step by step. It also has a character browser. Everything runs inside the extension: no text leaves your browser, nothing is collected and the extension asks for no access to the pages you visit.
  >
  > Source code and issue tracker: https://github.com/0xdolan/unichef

- **Images** (`make assets` writes them to `assets/branding/dist/store/`):
  - Store icon: `assets/branding/dist/ext/128.png`
  - Small promo tile (440×280): `chrome-promo-small.png`
  - Marquee (1400×560): `chrome-marquee.png`
  - Screenshots (1280×800): upload them in the order and with the captions in `screenshots.json`.
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
