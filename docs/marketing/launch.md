# Launch copy

Ready-to-post copy for the 1.0.0 launch. Before posting, check the facts against the release:
the version, the operation count (`spec/ops.json`), and that every install channel in the
README is live. Attach the social card (`assets/branding/dist/web/og-image.png`, from
`make assets`) or a screenshot from `assets/docs/screenshots/`. Links preview with the social
card on their own.

- Web app: <https://0xdolan.github.io/unichef/>
- Source: <https://github.com/0xdolan/unichef>

## The kit

| Asset | Where | Rebuild |
|---|---|---|
| Social card, 1200 × 630 (Open Graph, X) | `assets/branding/dist/web/og-image.png` | `make assets` |
| Repository social preview, 1280 × 640 | `assets/branding/dist/github/social-preview.png`; upload it under **Settings → General → Social preview** | `make assets` |
| Chrome Web Store tiles, 440 × 280 and 1400 × 560 | `assets/branding/dist/store/` | `make assets` |
| Logos and icons | `assets/branding/source/` (masters) and `assets/branding/dist/` | `make assets` |
| Desktop screenshots, light and dark, 1x and 2x | `assets/docs/screenshots/web/` (workbench, inspector, characters, regex, recipes, docs, tour) | `make screenshots` |
| Phone screenshots, 390 × 844 | `assets/docs/screenshots/phone/` (workbench, menu, character, docs, tour) | `make screenshots` |
| Extension and CLI screenshots | `assets/docs/screenshots/extension/`, `assets/docs/screenshots/cli/` | `make screenshots` |

The social card and the tiles show the banner master (`unichef-banner.svg`): the lockup over
the tagline "The cybersecurity and Unicode workbench". See the
[brand guide](../branding/README.md).

## The short pitch

> UniChef is a free, open-source cybersecurity and Unicode workbench. Encode, decode, hash,
> encrypt, compress and inspect data in recipes, and catch invisible, bidi and look-alike
> characters. It runs entirely in your browser and works offline, so nothing you paste is
> ever sent anywhere.

## X / Bluesky (under 280 characters)

1. Meet UniChef: a cybersecurity and Unicode workbench. Chain 97 operations (Base64, AES, HMAC,
   gzip, JWT…) into recipes, and see every hidden character. Runs offline in your browser.
   https://0xdolan.github.io/unichef/ #infosec #unicode #CTF

2. That "harmless" string has a U+202E in it. UniChef shows every invisible and bidi character
   as a label, flags look-alike letters, and `unichef scan` blocks Trojan Source in CI.
   https://github.com/0xdolan/unichef #appsec #TrojanSource #opensource

3. Decode, decrypt, decompress, then look at every byte. UniChef's inspector shows what each
   recipe step produced. Web app, browser extension, Python CLI and TypeScript library, same
   results everywhere. https://0xdolan.github.io/unichef/ #cybersecurity #CTF

## Mastodon

UniChef 1.0 is out: a free, open-source (GPL-3.0) cybersecurity and Unicode workbench.

- Chain encodings, hashes, ciphers and compression into recipes, and inspect every step.
- Every invisible, control and bidi character is shown as a label, and look-alike letters are
  flagged (UTS #39).
- Search and browse all of Unicode 18.0.
- Runs in your browser, installs as an app, and works offline. It makes no network requests.
- Also a browser extension, a Python CLI (`pipx install unichef`) and an npm library.

https://0xdolan.github.io/unichef/

#infosec #unicode #opensource #CTF #cybersecurity

## LinkedIn

I've released UniChef 1.0, a free, open-source workbench for security people and anyone who
handles text.

You can build a recipe from 97 operations: Base64 and friends, hashes and HMAC, AES and
PBKDF2, gzip, JWT and more. The output updates as you type. The inspector shows what each step
produced, byte by byte.

Its Unicode depth is what sets it apart. Invisible characters, bidi overrides and homoglyphs
are the tools behind Trojan Source and phishing domains. UniChef shows every one of them, and
`unichef scan` can fail a CI build when they appear in source code.

It runs entirely in your browser and works offline. Nothing you paste leaves your machine.

Try it: https://0xdolan.github.io/unichef/
Source: https://github.com/0xdolan/unichef

#cybersecurity #infosec #appsec #unicode #opensource

## Show HN

**Title:** Show HN: UniChef – an offline cybersecurity and Unicode workbench

**Text:**

UniChef is a recipe-based data workbench, in the spirit of CyberChef, with much deeper Unicode
support. You chain operations (encodings, hashes, HMAC, AES, compression, JWT, text tools) and
see the output as you type. An inspector shows each step's bytes and code points.

The Unicode side covers names, properties, normalisation, graphemes, bidi classes and UTS #39
confusables. Hidden characters are always rendered as labels, never raw. A CLI command,
`unichef scan`, fails CI on Trojan Source bidi controls.

There are two cores, Python and TypeScript, and they pass the same shared test vectors. The web
app is a PWA with a strict CSP that makes no network requests. It can also import CyberChef
recipes. The licence is GPL-3.0.

https://github.com/0xdolan/unichef

## Reddit (r/netsec, r/cybersecurity, r/securityCTF)

Check each subreddit's self-promotion rules first. Lead with what the tool does, not the
launch.

**Title:** UniChef: an open-source, offline workbench for decoding data and catching hidden
Unicode (Trojan Source, homoglyphs)

**Body:** Use the Mastodon text, and add one concrete example: a file name made of U+202E
RIGHT-TO-LEFT OVERRIDE followed by `txt.exe` displays as `exe.txt`. Paste it into the
workbench and UniChef shows the override as a label.

## Hashtags

| Audience | Tags |
|---|---|
| Security | #infosec #cybersecurity #appsec #CTF #TrojanSource #homoglyphs |
| Unicode and text | #unicode #i18n #typography |
| Developers | #opensource #python #typescript #webdev #PWA |

Use two or three per post. More reads as spam on most networks.
