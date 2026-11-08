<!-- Screenshots come from `make screenshots` (scripts/screenshots/cli.py and clients/web/screenshots/). -->

# Introduction to UniChef

- [What is UniChef](#what-is-unichef)
- [Install](#install)
- [CLI tour](#cli-tour)
- [Web tour](#web-tour)
- [Browser extension](#browser-extension)
- [Recipes](#recipes)
- [Security recipes](#security-recipes)
- [Output formats](#output-formats)
- [Troubleshooting](#troubleshooting)
- [Licences and credits](#licences-and-credits)

## What is UniChef

UniChef is a workbench for Unicode text and encoded data. You chain operations into a **recipe**: decode Base64, normalise to NFC, reveal invisible characters, hash the bytes, and so on. You run it on some input and see what each step produced. It also gives you a character database and security checks for invisible, bidi and confusable characters.

The same operations ship as a Python library and CLI, a TypeScript library and an offline web app. Both cores read the same pinned Unicode Character Database (Unicode 18.0.0) and pass the same test vectors, so a recipe gives the same output in a terminal as in a browser.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/web/dark/1x/workbench.png 1x, assets/docs/screenshots/web/dark/2x/workbench.png 2x">
  <img src="assets/docs/screenshots/web/light/1x/workbench.png" srcset="assets/docs/screenshots/web/light/1x/workbench.png 1x, assets/docs/screenshots/web/light/2x/workbench.png 2x" width="800" height="500" alt="The UniChef workbench: an operation list on the left, a two-step recipe (Normalize, then To Base64) in the middle, and the input and Base64 output on the right.">
</picture>

UniChef is in alpha (0.1.0-alpha.1). Operations and recipe files may still change before 1.0.

## Install

| Surface | How | Status |
| --- | --- | --- |
| Python CLI and library | `pipx install "git+https://github.com/0xdolan/unichef.git#subdirectory=packages/python-cli"` | Available from source |
| | `uv tool install "git+https://github.com/0xdolan/unichef.git#subdirectory=packages/python-cli"` | Available from source |
| | `pip install unichef` / `pipx install unichef` / `uv tool install unichef` | Planned (first PyPI release) |
| Ubuntu (noble, resolute) | `sudo add-apt-repository ppa:0xdolan/unichef && sudo apt install unichef` | Planned |
| TypeScript library | `npm install @unichef/core` | Planned (first npm release) |
| Web app | <https://0xdolan.github.io/unichef/>. Installable, and works offline after the first visit. | Available |
| Chrome, Edge, Firefox | Store listings | Planned (M3) |
| Safari | Build locally with Xcode from `clients/extensions/` | Planned (M3) |

The CLI needs Python 3.12 or later. Check the install with:

```sh
unichef version
# unichef 0.1.0-alpha.1 (UCD 18.0.0, Python 3.12.12)
```

To set up shell completion, run `unichef completion bash` (or `zsh`, `fish` or `powershell`) and follow the instructions it prints.

## CLI tour

Every command takes its input as an argument, from a file with `-i FILE`, or from stdin. Run `unichef --help` for the full command tree and `unichef COMMAND --help` for examples.

### inspect: what is in this string

`inspect` lists every code point with its name, category, script, block and UTF-8 bytes. Characters that need a second look are flagged. In this example the second letter is CYRILLIC SMALL LETTER A.

```sh
unichef inspect 'pаypal'
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/cli/dark/1x/inspect.png 1x, assets/docs/screenshots/cli/dark/2x/inspect.png 2x">
  <img src="assets/docs/screenshots/cli/light/1x/inspect.png" srcset="assets/docs/screenshots/cli/light/1x/inspect.png 1x, assets/docs/screenshots/cli/light/2x/inspect.png 2x" width="800" height="300" alt="unichef inspect on &quot;pаypal&quot;: a table of six code points. The second, U+0430 CYRILLIC SMALL LETTER A, is flagged confusable and mixed-script.">
</picture>

### char: one character in full

`char` accepts a character, `U+XXXX`, `0xXXXX`, a decimal value or a name.

```sh
unichef char U+202E
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/cli/dark/1x/char.png 1x, assets/docs/screenshots/cli/dark/2x/char.png 2x">
  <img src="assets/docs/screenshots/cli/light/1x/char.png" srcset="assets/docs/screenshots/cli/light/1x/char.png 1x, assets/docs/screenshots/cli/light/2x/char.png 2x" width="800" height="300" alt="unichef char U+202E: the properties of RIGHT-TO-LEFT OVERRIDE, including bidi class RLO and the flags bidi-control and default-ignorable.">
</picture>

### search: find characters by name or property

A query can be words, a `/regex/` over names, or property tests joined with `&`, such as `gc=Sm & age<=6.0`.

```sh
unichef search --limit 6 'black chess'
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/cli/dark/1x/search.png 1x, assets/docs/screenshots/cli/dark/2x/search.png 2x">
  <img src="assets/docs/screenshots/cli/light/1x/search.png" srcset="assets/docs/screenshots/cli/light/1x/search.png 1x, assets/docs/screenshots/cli/light/2x/search.png 2x" width="800" height="222" alt="unichef search for &quot;black chess&quot;: six results from BLACK CHESS KING to BLACK CHESS PAWN, with code point, block and script.">
</picture>

### op: run one operation

`unichef ops` lists the operations. Arguments are passed as `--arg NAME=VALUE`, or as a JSON object with `--arg-json`.

```sh
unichef op to-punycode --arg domain=true münchen.de
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/cli/dark/1x/op.png 1x, assets/docs/screenshots/cli/dark/2x/op.png 2x">
  <img src="assets/docs/screenshots/cli/light/1x/op.png" srcset="assets/docs/screenshots/cli/light/1x/op.png 1x, assets/docs/screenshots/cli/light/2x/op.png 2x" width="800" height="64" alt="unichef op to-punycode on münchen.de prints xn--mnchen-3ya.de.">
</picture>

### bake: run a recipe

`bake -r FILE` runs a recipe file. `--steps` prints each step's output, and `--until N` stops after step N. The recipe here is one from the web app's gallery: it reports invisible characters.

```sh
unichef bake -r reveal-invisible.json $'a​b⁠c'
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/cli/dark/1x/bake.png 1x, assets/docs/screenshots/cli/dark/2x/bake.png 2x">
  <img src="assets/docs/screenshots/cli/light/1x/bake.png" srcset="assets/docs/screenshots/cli/light/1x/bake.png 1x, assets/docs/screenshots/cli/light/2x/bake.png 2x" width="800" height="143" alt="unichef bake with the reveal-invisible recipe: a table listing U+200B ZERO WIDTH SPACE at column 2 and U+2060 WORD JOINER at column 4.">
</picture>

### scan: check files for Trojan Source and look-alikes

`scan` walks files and directories and reports bidi controls, invisible characters, confusables and mixed-script identifiers. With `--fail-on`, it exits with status 6 when it finds one of the listed kinds.

```sh
unichef scan auth.js
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/cli/dark/1x/scan.png 1x, assets/docs/screenshots/cli/dark/2x/scan.png 2x">
  <img src="assets/docs/screenshots/cli/light/1x/scan.png" srcset="assets/docs/screenshots/cli/light/1x/scan.png 1x, assets/docs/screenshots/cli/light/2x/scan.png 2x" width="800" height="190" alt="unichef scan auth.js: four bidi findings on line 2 (RIGHT-TO-LEFT OVERRIDE, two LEFT-TO-RIGHT ISOLATE and one POP DIRECTIONAL ISOLATE), then &quot;Scanned 1 file(s): 4 finding(s).&quot;">
</picture>

## Web tour

The web app at <https://0xdolan.github.io/unichef/> runs entirely in your browser. Input never leaves the page. Once it has loaded, it works offline.

### Build a recipe

Type in **Search operations**, then click an operation to add it to the recipe. The output recomputes as you type. You can drag steps to reorder them, switch them off, or turn off **Auto-bake** and press **Bake** to run on demand. The screenshot in [What is UniChef](#what-is-unichef) shows a two-step recipe.

### Inspect a step

Click a step's name to see the output of that step alone in the **Inspector**, as text or hex.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/web/dark/1x/inspector.png 1x, assets/docs/screenshots/web/dark/2x/inspector.png 2x">
  <img src="assets/docs/screenshots/web/light/1x/inspector.png" srcset="assets/docs/screenshots/web/light/1x/inspector.png 1x, assets/docs/screenshots/web/light/2x/inspector.png 2x" width="800" height="500" alt="The workbench with a To Hex then Reverse recipe. The inspector shows step 1&#x27;s output, 68 69 20 e2 9c 93, while the final output is the hex reversed.">
</picture>

### Share a link

**Copy link** puts the recipe and input in the URL fragment (`#/?r=…&i=…`). The fragment is never sent to a server. Opening the link restores both.

### Character explorer

**Characters** searches names and properties with the same query language as `unichef search`. Click a character to see all its properties.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/web/dark/1x/chars.png 1x, assets/docs/screenshots/web/dark/2x/chars.png 2x">
  <img src="assets/docs/screenshots/web/light/1x/chars.png" srcset="assets/docs/screenshots/web/light/1x/chars.png 1x, assets/docs/screenshots/web/light/2x/chars.png 2x" width="800" height="500" alt="The Characters page with the query name~/ARROW$/ &amp; gc=Sm &amp; age&lt;=6.0, showing a grid of 73 arrow characters.">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/web/dark/1x/char.png 1x, assets/docs/screenshots/web/dark/2x/char.png 2x">
  <img src="assets/docs/screenshots/web/light/1x/char.png" srcset="assets/docs/screenshots/web/light/1x/char.png 1x, assets/docs/screenshots/web/light/2x/char.png 2x" width="800" height="500" alt="The character page for U+202E RIGHT-TO-LEFT OVERRIDE.">
</picture>

**Blocks** and **Scripts** browse the database by block and by script.

### Regex lab

**Regex** matches a pattern against test text using UniChef's portable regex profile. The syntax and results are the same as `unichef regex`, and `\p{…}` classes come from the pinned Unicode data rather than from the browser.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/web/dark/1x/regex.png 1x, assets/docs/screenshots/web/dark/2x/regex.png 2x">
  <img src="assets/docs/screenshots/web/light/1x/regex.png" srcset="assets/docs/screenshots/web/light/1x/regex.png 1x, assets/docs/screenshots/web/light/2x/regex.png 2x" width="800" height="500" alt="The regex lab with the pattern \p{Lu}\p{L}*|\p{Nd}+ highlighting three matches: Café, CAFÉ and the Arabic-Indic digits ٣٤٥.">
</picture>

## Browser extension

The Chrome, Edge, Firefox and Safari extensions are planned for milestone M3. They will let you send selected text on any page to a recipe and inspect characters on hover. This section will gain a tour and screenshots when they ship.

## Recipes

A recipe is a JSON file with a `version`, an optional `name` and `description`, and a list of `steps`. Each step has an `op` id and, optionally, `args`. The schema is [spec/recipe.schema.json](spec/recipe.schema.json).

```json
{
  "version": 1,
  "name": "Hex per line",
  "steps": [
    {
      "op": "fork",
      "args": {
        "split": "\n",
        "merge": "\n",
        "steps": [{ "op": "normalize", "args": { "form": "NFC" } }, { "op": "to-hex" }]
      }
    }
  ]
}
```

Flow-control operations such as `fork` hold their nested steps in `args.steps`. This recipe splits the input into lines, normalises each line to NFC, writes it as hex, and joins the results with newlines:

```sh
printf 'café\nnaïve' | unichef bake -r hex-per-line.json --newline
# 63 61 66 c3 a9
# 6e 61 c3 af 76 65
```

- `unichef recipe validate FILE` checks a recipe against the schema and the operation registry.
- `unichef recipe fmt FILE` prints it in canonical form.
- `unichef recipe import-cyberchef FILE` converts a CyberChef recipe, in JSON or chef format, for the operations UniChef has. Anything it cannot translate is an error, never a silent change. The web app's **Import** button does the same.

### Gallery

**Recipes** in the web app lists ready-made recipes for common jobs. Each opens in the workbench with a sample input. The files are in [clients/web/src/features/recipes/gallery/](clients/web/src/features/recipes/gallery/) and run unchanged with `unichef bake -r`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/docs/screenshots/web/dark/1x/recipes.png 1x, assets/docs/screenshots/web/dark/2x/recipes.png 2x">
  <img src="assets/docs/screenshots/web/light/1x/recipes.png" srcset="assets/docs/screenshots/web/light/1x/recipes.png 1x, assets/docs/screenshots/web/light/2x/recipes.png 2x" width="800" height="500" alt="The recipe gallery: twelve cards, including Check for mixed scripts, Remove bidi controls (Trojan Source) and Reveal invisible characters, each with an Open in the workbench button.">
</picture>

## Security recipes

### Block Trojan Source in CI

Bidi controls can make code read differently from how it runs ([CVE-2021-42574](https://trojansource.codes/)). This job fails a pull request that adds bidi controls or invisible characters:

```yaml
name: unicode-scan
on: [pull_request]
permissions:
  contents: read
jobs:
  scan:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-python@v6
        with:
          python-version: "3.12"
      - run: pipx install "git+https://github.com/0xdolan/unichef.git#subdirectory=packages/python-cli"
      - run: unichef scan --fail-on bidi,invisible --exclude 'node_modules/**' .
```

The step's exit status is 6 when there are findings. Add `--format json` to get output that other tools can read.

### Check a domain for homoglyphs

Look-alike domains mix scripts or use characters that are confusable with Latin letters. Three checks give a quick verdict:

```sh
unichef op script-mix-check 'pаypal.com' --newline
# Minimally Restrictive          (Latin mixed with Cyrillic: suspicious)

unichef op detect-confusables --arg reference=paypal.com 'pаypal.com'
# input-skeleton … reference-skeleton … confusable: true

unichef op idna-to-ascii 'pаypal.com' --newline
# xn--pypal-4ve.com              (what the browser actually resolves)
```

The **Check for mixed scripts** and **Compare confusable skeletons** gallery recipes do the same in the web app.

## Output formats

`--format` picks the output format:

- `table`: aligned and coloured, for reading. This is the default on a terminal.
- `raw`: the plain result, with tables as tab-separated values. This is the default when the output is piped.
- `json`: an envelope with the UniChef and UCD versions, `ok`, and a typed `result`. Errors are JSON too. The schema is [spec/output.schema.json](spec/output.schema.json).

Raw output pipes cleanly between commands:

```sh
printf 'hé' | unichef op encode-text | unichef op to-hex --newline
unichef inspect 'hé' --format json | jq '.result.value.rows[][1]'
```

`-o FILE` writes the result atomically. `--input-encoding hex` or `base64` reads encoded input. `--newline` ends raw output with a newline.

Exit codes are 0 for success, 1 for a data or argument error, 2 for usage, 3 for input I/O, 4 for a recipe error, 5 for a regex timeout, 6 for scan findings and 130 for cancellation.

## Troubleshooting

- **Windows console shows boxes or `?`.** Use Windows Terminal, or run `chcp 65001` in the legacy console. UniChef always writes UTF-8 and turns on ANSI colour itself.
- **No colour, or colour in a log.** `NO_COLOR` (any value) turns colour off and `FORCE_COLOR=1` forces it on. `--color always|never` overrides both, and `--theme light` or `--theme mono` suits light backgrounds and monochrome terminals.
- **Large inputs.** Input is capped at 1 GiB by default. Raise or lower the cap with `--max-input-size 4G`. Operations whose output can grow, such as decompression, stop with `E_LIMIT` instead of filling memory.
- **Regex timeout.** A pattern that runs past its budget stops with `E_REGEX_TIMEOUT` and exit status 5. Raise the budget with `--regex-timeout MS` (the default is 2000), or simplify the pattern. The web lab has the same setting.
- **A recipe works in one place but not another.** Run `unichef recipe validate` and compare `unichef version` with the web app's **About** page. Both should report the same UCD version.

## Licences and credits

UniChef is free software under GPL-3.0-or-later. See [LICENSE](LICENSE).

- The Unicode Character Database is © Unicode, Inc., under the Unicode License v3.
- The CyberChef recipe mapping and some test vectors come from CyberChef (Apache-2.0, Crown Copyright).
- Screenshots are set in JetBrains Mono (SIL OFL 1.1).

[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists every third-party component and its licence.
