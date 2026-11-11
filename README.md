<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/branding/source/unichef-logo.svg">
    <img src="assets/branding/source/unichef-logo-light.svg" alt="UniChef" width="360">
  </picture>
</p>

<p align="center"><strong>The cybersecurity and Unicode workbench.</strong><br>
Encode, decode, hash, encrypt, compress and inspect data in one recipe, and see every character for what it really is.</p>

<p align="center">
  <a href="https://0xdolan.github.io/unichef/">Open the web app</a> ·
  <a href="INTRODUCTION.md">Introduction</a> ·
  <a href="docs/roadmap.md">Roadmap</a> ·
  <a href="https://github.com/0xdolan/unichef/releases">Releases</a>
</p>

# UniChef

UniChef is a workbench for security analysts, CTF players, developers and anyone who handles
encoded data or text from untrusted sources. You chain operations into a **recipe**: decode
Base64, gunzip, decrypt AES, hash the result, reveal the zero-width characters someone hid in
it. UniChef shows the output of every step. It runs entirely offline: nothing you paste leaves
your machine.

Two things set it apart:

- **Security analysis.** 97 operations for encoding, hashing, encryption, compression and
  data formats. Recipes import from CyberChef.
- **Unicode depth.** Every result comes from UniChef's own copy of the Unicode Character
  Database (Unicode 18.0.0), not from whatever the browser or Python happens to ship. That is
  how it catches attacks that hide in text:
  - Trojan Source bidi controls in code;
  - homoglyph domains such as `pаypal.com` with a Cyrillic `а`;
  - invisible characters in names and messages;
  - mixed-script spoofing.

## What it does

| Area | Operations |
|---|---|
| **Encoding** | Base64, Base32, Base58, Base85, hex, binary, octal, decimal, URL, HTML entities, Quoted-Printable, Punycode, IDNA, text encodings (UTF-8, UTF-16, UTF-32, Latin-1, Windows-1252, ASCII) |
| **Hashing** | MD5, SHA-1, SHA-2, SHA-3, SHAKE, BLAKE2b/2s, CRC-32, Adler-32, HMAC |
| **Crypto** | AES (CBC, CTR, GCM, ECB), PBKDF2, JWT sign, verify and decode, XOR, ROT13, ROT47, Atbash, Vigenère, secure random bytes |
| **Compression** | Gzip, Zlib and raw Deflate, both ways |
| **Data** | JSON beautify and minify, CSV ↔ JSON, URL and query-string parsing |
| **Text** | Regex extract, find and replace, split, join, sort, unique, head, tail, trim, reverse |
| **Unicode** | Code points, UTF-8 explained byte by byte, normalisation (NFC, NFD, NFKC, NFKD), case mapping, graphemes, diacritics, escapes, bidi classes, property filters |
| **Security** | Invisible-character detection, confusable and homoglyph detection (UTS #39), script-mix checks, bidi-control removal, and `unichef scan` to block Trojan Source in CI |
| **Flow** | Fork, subsection, sub-recipes, labels, jumps and conditional jumps |

The [roadmap](docs/roadmap.md) plans the rest of CyberChef's catalogue for milestones 1.1 to
2.0:
- more encodings;
- every common hash;
- classical and modern ciphers;
- network and certificate parsers;
- extractors and forensics.

A character explorer, a regex lab and a recipe gallery come with the web app.

## Where it runs

| Surface | Get it |
|---|---|
| Web app | <https://0xdolan.github.io/unichef/>. It installs as an app and works offline. |
| Browser extension | Chrome, Brave, Edge and Firefox. Select text, right-click, then "Inspect with UniChef". |
| Python CLI and library | `pipx install unichef` |
| Ubuntu | `sudo add-apt-repository ppa:0xdolan/unichef && sudo apt install unichef` |
| TypeScript library | `npm install @unichef/core` |
| Container | `docker run --rm -i ghcr.io/0xdolan/unichef:<version> op to-hex <<< "hi"` |

Both cores pass the same test vectors, so a recipe gives the same output in a terminal as in
a browser. [INTRODUCTION.md](INTRODUCTION.md) has every install channel and a tour of the
CLI, the web app and the extension, with screenshots.

```sh
$ unichef op to-base64 <<< "café"
Y2Fmw6kK
$ unichef scan --fail-on bidi src/      # fail CI on Trojan Source bidi controls
```

## Contributing

The repository follows Gitflow with Conventional Commits. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Brand rules and logo files are described in [docs/branding/README.md](docs/branding/README.md).

## Licence

GPL-3.0-or-later. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
