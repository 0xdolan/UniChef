<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Levenshtein Distance

Split the input on `delimiter` into two samples. Write the least total cost of the insertions, deletions and substitutions of characters (code points) that turn the first sample into the second. The product of the two lengths may be at most 4000000.

| Id | Input | Output | Background |
|---|---|---|---|
| `levenshtein-distance` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into two samples at `delimiter` (a line feed by default). The result is the
smallest total cost of the edits that turn the first sample into the second, where an edit
inserts, deletes or substitutes one character (a Unicode code point). Each kind of edit has its
own cost; all three default to 1.

The operation fills a table with one cell per pair of characters: each cell is the cheapest of
deleting, inserting, or substituting (free when the characters match) from its neighbours. The
two lengths multiplied may be at most 4000000.

**Worked example: `kitten` → `sitting`**

| Edit | Result |
|---|---|
| substitute `k` → `s` | `sitten` |
| substitute `e` → `i` | `sittin` |
| insert `g` | `sitting` |

Distance: `3`. With `substitution=3`, replacing a letter costs more than deleting and inserting
(2), so the distance becomes `5`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | string | `\n` | — |
| `insertion` | integer 0 to 1000000 | `1` | — |
| `deletion` | integer 0 to 1000000 | `1` | — |
| `substitution` | integer 0 to 1000000 | `1` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `kitten\nsitting` | — | `3` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKSS1LzSvOKEnNzNNNySwuScxLTlXSUUosSgcqqq6tja0FAA&i=y84sKUnN4yoGUpl56QA), or search for "Levenshtein Distance" in the operation list.

**CLI:**

```sh
unichef op levenshtein-distance
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("levenshtein-distance", {}, Dish.of_string("kitten\nsitting"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("levenshtein-distance", {}, { type: 'string', value: "kitten\nsitting" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Levenshtein distance on Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_distance)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Hamming Distance](hamming-distance.md)

<!-- docs:nav -->
---

[← JSON to CSV](json-to-csv.md) · [Contents](../../README.md) · [Parse Query String →](parse-query-string.md)
<!-- /docs:nav -->
