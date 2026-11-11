# CyberChef: Investigation Notes

Commit `d4d96c6c3d2597fef836d81bfc04617d97c681a5` (package version 11.5.0, 2026-11-04).

## 1. What it is

CyberChef is a client-side web app and Node.js package. It runs "recipes" of operations over data in the browser. Its own `AGENTS.md` names these design principles, all of which UniChef shares:

- Work client-side, with no external services, because CyberChef is used on air-gapped networks.
- Keep latency low by splitting large libraries into lazily loaded modules.
- Add as few new dependencies as possible.

## 2. Repository layout

| Path | Contents |
|---|---|
| `src/core/` | The engine: `Chef.mjs`, `Recipe.mjs`, `Operation.mjs`, `Ingredient.mjs`, `Dish.mjs`, `Utils.mjs` and `ChefWorker.js` |
| `src/core/operations/` | 506 operation classes, one per file (e.g. `ToBase64.mjs`) |
| `src/core/lib/` | Shared helpers for operations (e.g. `Base64.mjs`, `ChrEnc.mjs`, `Magic.mjs`) |
| `src/core/dishTypes/` | Dish types: `ArrayBuffer`, `byteArray`, `string`, `number`, `BigNumber`, `JSON`, `File`, `List<File>`, `html` |
| `src/core/errors/` | `OperationError` for expected user-input failures, `DishError`, and `ExcludedOperationError` for operations not available in Node |
| `src/core/config/Categories.json` | Category-to-operation index |
| `src/node/` | Node API (`api.mjs`, `NodeDish.mjs`, `NodeRecipe.mjs`, `repl.mjs`). `config/excludedOperations.mjs` lists ops excluded from Node. |
| `src/web/` | UI built with vanilla JS and a "waiters" pattern (`App.mjs`, `Manager.mjs`, `waiters/`, `workers/`), bundled with webpack and Grunt |
| `tests/operations/tests/` | 203 operation test files using `TestRegister.addTests([...])` |
| `tests/node/`, `tests/browser/` | Node API tests and Nightwatch UI tests |

**Toolchain.** Node `>=24 <27`, npm, webpack, Grunt, Babel and ESLint. There are about 100 runtime dependencies.

**npm package.** Published as `cyberchef`. `exports` provides `import` (`src/node/index.mjs`) and `require` (`src/node/wrapper.js`).

## 3. Operation model

```js
class ToBase64 extends Operation {
    constructor() {
        super();
        this.name = "To Base64";          // display name = identifier
        this.module = "Default";          // lazy-load chunk
        this.description = "…HTML…";
        this.infoURL = "https://wikipedia.org/wiki/Base64";
        this.inputType = "ArrayBuffer";
        this.outputType = "string";
        this.args = [{ name: "Alphabet", type: "editableOption", value: ALPHABET_OPTIONS }];
    }
    run(input, args) { return toBase64(input, args[0]); }   // args are positional
    highlight(pos, args) { … }                               // maps output offsets to input offsets
    highlightReverse(pos, args) { … }
}
```

Points that affect UniChef:

- **The display name is the identifier.** Recipes refer to ops by their display name (`"To Base64"`). UniChef uses stable kebab-case ids instead.
- **Arguments are positional.** Many argument values are display strings. For example, Base64's `alphabet` argument is `"A-Za-z0-9+/="`, and the escape prefix is one of `"\\u"`, `"%u"` or `"U+"`.
- **Argument types**, by frequency: `option`, `boolean`, `number`, `toggleString`, `string`, `editableOption`, `text`, `binaryString`, `argSelector`, `editableOptionShort`, `binaryShortString`, `populateOption`, `label` and `shortString`. UniChef's `ArgSpec` kinds cover these:

  | CyberChef type | UniChef kind |
  |---|---|
  | `toggleString` | `bytes`, with an encoding selector |
  | `argSelector` | conditional UI over `enum` |
  | `editableOption` | `enum` with a `custom` value |

- **Highlighting.** `highlight` and `highlightReverse` map offsets between input and output. The UniChef PRD has no equivalent; see [gap-analysis.md](gap-analysis.md).
- **Validation.** Argument constraints are declared in `args` metadata and enforced by `Operation.validateIngredients()` before `run()` executes. User-caused failures throw `OperationError`.

## 4. Recipe formats

1. **JSON:** `[{"op":"To Base64","args":["A-Za-z0-9+/="]}]`. A step may also carry `"disabled": true` and `"breakpoint": true`.
2. **"Chef" (pretty) format:** `To_Base64('A-Za-z0-9+/=')From_Hex('Auto')`. Op names use `_` in place of spaces, string arguments use single quotes, and `/disabled` and `/breakpoint` are suffixes inside the parentheses.

   `Utils.parseRecipeConfig()` parses this format. If the trimmed text starts with `[`, it is treated as JSON; otherwise it is matched with the regex `([^(]+)\(((?:'[^'\\]*(?:\\.[^'\\]*)*'|[^)/'])*)(\/[^)]+)?\)`.

   The web UI writes the chef format into the URL (`ControlsWaiter.generateStateUrl` → `Utils.generatePrettyRecipe`), together with the input.

**Flow control is linear, not nested.** The flow-control ops are `Fork`, `Subsection`, `Merge`, `Register`, `Label`, `Jump`, `Conditional Jump`, `Return`, `Comment` and `Magic`.

- `Fork` and `Subsection` apply to every following op until a `Merge`.
- `Register` captures regex groups into `$R0`, `$R1`, … for use in later arguments.
- `Return` stops the recipe.
- `Magic` detects likely encodings and returns JSON describing them.

## 5. Unicode handling (weak points UniChef improves on)

| Op | CyberChef behaviour | Issue |
|---|---|---|
| Normalise Unicode | Uses the `unorm` npm library, with forms `NFD`, `NFC`, `NFKD`, `NFKC` | The Unicode version is fixed by that library, not chosen by the project. |
| Remove Diacritics | `input.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` | Strips only the Combining Diacritical Marks block, and relies on the host engine's normalisation. |
| Escape Unicode Characters | Prefix `\u`, `%u`, `U+`; encode all; padding; uppercase hex | No `\u{…}`, `&#x…;` or `\U`. Surrogate handling depends on the input string. |
| Unicode Text Format | Underline and strikethrough via combining characters | Not planned for UniChef. |

There is no character database, no character search by name or property, and no detection of bidi controls, confusables or invisible characters.

## 6. Tests (reusable as UniChef vectors)

```js
TestRegister.addTests([
  { name: "To Base64: Hello, World!", input: "Hello, World!", expectedOutput: "SGVsbG8sIFdvcmxkIQ==",
    recipeConfig: [{ op: "To Base64", args: ["A-Za-z0-9+/="] }] },
]);
```

The 203 test files are an existing body of input/output cases. For every op UniChef maps (see [cyberchef-operations.md](cyberchef-operations.md)), a converter script can turn these cases into `spec/vectors/*.json`:

1. Translate positional arguments through `spec/cyberchef-map.json`.
2. Convert `input` and `expectedOutput` to typed dishes.
3. Record provenance in each case: `"source": "cyberchef@<commit>:tests/operations/tests/<file>"`.

The test files are Apache-2.0, so attribution goes in `THIRD_PARTY_NOTICES.md`.

## 7. Licence obligations (Apache-2.0 → GPL-3.0-or-later)

- Porting code or tests is allowed, because Apache-2.0 → GPLv3 is a one-way compatible combination.
- Keep the copyright headers in ported files. CyberChef headers name the author and `@copyright Crown Copyright <year>`.
- State in each ported file that it was changed.
- CyberChef has no `NOTICE` file at this commit, so there is no NOTICE text to carry over. Check again whenever the pinned commit is updated.
- Don't use "CyberChef", GCHQ marks or the chef logo in UniChef branding. "Recipes compatible with CyberChef" is acceptable descriptive wording.
- Check the licence of each third-party library CyberChef vendors (`src/core/vendor/`) separately before porting code that depends on it.
