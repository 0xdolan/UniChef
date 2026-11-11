# Microsoft Edge Add-ons listing

Paste these into Partner Center (**Microsoft Edge** → **Overview** → the UniChef product). The package is `unichef-edge-<version>.zip`, which `make build-ext` writes and every GitHub Release attaches.

## Properties

- **Category:** Developer tools
- **Privacy policy:** Yes, https://github.com/0xdolan/unichef/blob/main/PRIVACY.md
- **Website:** https://0xdolan.github.io/unichef/
- **Support contact:** https://github.com/0xdolan/unichef/issues
- **Mature content:** No

## Availability

- **Visibility:** Public
- **Markets:** All markets

## Store listing (English)

- **Description:**

  > UniChef shows what a piece of text is really made of. Select text on any page, right-click and choose "Inspect with UniChef" to see every code point with its name, general category and script, and invisible and bidirectional control characters listed first.
  >
  > The side panel also runs UniChef recipes (encode, decode, normalise, escape and more) and has a character browser. Everything runs inside the extension: no text leaves your browser, nothing is collected and the extension asks for no access to the pages you visit.
  >
  > Source code and issue tracker: https://github.com/0xdolan/unichef

- **Short description:** taken from the manifest's `description`.
- **Search terms:** Unicode, characters, invisible characters, encoding, developer tools
- **Images** (`make assets` writes them to `assets/branding/dist/store/`):
  - Extension logo (300×300): `edge-logo-300.png`
  - Small promotional tile (440×280): `chrome-promo-small.png`
  - Large promotional tile (1400×560): `chrome-marquee.png`
  - Screenshots (1280×800): the files and order in `../../chrome/store/screenshots.json`

## Certification notes

> UniChef needs no account and no test data. Select any text on a web page, right-click and choose "Inspect with UniChef"; the side panel opens with the selection. Permissions: `contextMenus` (the menu item), `storage` (settings, and passing the selection to the panel), `sidePanel` (the panel). It has no host permissions, no content scripts and no remote code (CSP `script-src 'self'`). Source: https://github.com/0xdolan/unichef
