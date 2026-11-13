<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Sets and distances: comparing lists and strings

Two lists of names, two versions of a key, two spellings of a word: often the question is
what they share or how far apart they are. The set operations compare lists item by item.
The distance operations put a single number on how different two strings are.

## Samples and items

Every operation here reads one input holding two or more **samples**. A sample is cut from
the input at `sample_delimiter` (a blank line by default), and each sample is cut into
**items** at `item_delimiter` (a comma by default):

```text
alice,bob,carol

bob,dave
```

is two samples, `alice,bob,carol` and `bob,dave`.

Each sample is treated as a **set**: an item that appears twice counts once, and the result
lists each item once, in the order it was first seen. Items are compared exactly, so `Bob`
and `bob` are different items. To compare without case, run
[Unicode case](../reference/ops/unicode-case.md) first.

## Set operations

With the samples `A = alice,bob,carol` and `B = bob,dave`:

| Operation | Keeps | Result |
|---|---|---|
| [Set Union](../reference/ops/set-union.md) | items in A or B | `alice,bob,carol,dave` |
| [Set Intersection](../reference/ops/set-intersection.md) | items in A and B | `bob` |
| [Set Difference](../reference/ops/set-difference.md) | items in A but not B | `alice,carol` |
| [Symmetric Difference](../reference/ops/symmetric-difference.md) | items in exactly one | `alice,carol,dave` |

Typical uses: which accounts are in the export but not in the directory (difference), which
hosts appear in both logs (intersection), and what changed between two lists (symmetric
difference).

[Cartesian Product](../reference/ops/cartesian-product.md) pairs every item of one sample with
every item of the next: `1,2` and `a,b` give `(1,a),(1,b),(2,a),(2,b)`. With more samples the
tuples grow longer. The count is the product of the sample sizes, so it grows fast; UniChef
stops at 100000 tuples.

[Power Set](../reference/ops/power-set.md) lists every subset of one sample, from the empty set
to the whole sample. A sample of *n* items has 2ⁿ subsets, so the input is limited to 16 items
(65536 lines).

## Hamming distance

The [Hamming distance](../reference/ops/hamming-distance.md) of two equal-length strings is the
number of positions where they differ. `karolin` and `kathrin` differ at three letters, so the
distance is 3. It only makes sense for equal lengths; anything else is an error.

Count `byte` positions to compare text or fixed-size codes, and `bit` positions to compare
keys, hashes or error-correcting codes. A single flipped bit in a key gives a bit distance of
1. Text is compared as UTF-8 bytes, so `é` and `è` (two bytes each) differ in one byte. Set
`input_type` to `hex` to compare bytes written as hex.

## Levenshtein distance

The [Levenshtein distance](../reference/ops/levenshtein-distance.md), or edit distance, is the
smallest number of single-character insertions, deletions and substitutions that turn one
string into the other. Unlike the Hamming distance it works for strings of any length.

`kitten` → `sitting` takes three edits: substitute `k` with `s`, substitute `e` with `i`, and
insert `g`. The operation fills a table where each cell holds the distance between two
prefixes, and each cell is the cheapest of three moves from its neighbours:

|   | | s | i | t | t | i | n | g |
|---|---|---|---|---|---|---|---|---|
| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| k | 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| i | 2 | 2 | 1 | 2 | 3 | 4 | 5 | 6 |
| t | 3 | 3 | 2 | 1 | 2 | 3 | 4 | 5 |
| t | 4 | 4 | 3 | 2 | 1 | 2 | 3 | 4 |
| e | 5 | 5 | 4 | 3 | 2 | 2 | 3 | 4 |
| n | 6 | 6 | 5 | 4 | 3 | 3 | 2 | 3 |

The bottom-right cell is the answer. Each edit has a cost you can change: making a
substitution cost 2 or more means the operation prefers a deletion and an insertion instead.
Characters are Unicode code points, so an emoji counts as one character. The table has one
cell for each pair of characters, and UniChef allows up to 4000000 cells.

Edit distance finds typos and near-duplicate names, and spots look-alike domain names when used
with [Unicode security](unicode-security.md) checks.

<!-- docs:ops -->
Operations explained here: [Cartesian Product](../reference/ops/cartesian-product.md), [Hamming Distance](../reference/ops/hamming-distance.md), [Levenshtein Distance](../reference/ops/levenshtein-distance.md), [Power Set](../reference/ops/power-set.md), [Set Difference](../reference/ops/set-difference.md), [Set Intersection](../reference/ops/set-intersection.md), [Set Union](../reference/ops/set-union.md), [Symmetric Difference](../reference/ops/symmetric-difference.md).
<!-- /docs:ops -->

## Learn more

- [Set (mathematics) on Wikipedia](https://en.wikipedia.org/wiki/Set_(mathematics))
- [Hamming distance on Wikipedia](https://en.wikipedia.org/wiki/Hamming_distance)
- [Levenshtein distance on Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [Wagner–Fischer algorithm on Wikipedia](https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm)

<!-- docs:nav -->
---

[← Number and key formats: floats, BCD, text as a number, Bech32 and PEM](number-formats.md) · [Contents](../README.md) · [Operation reference →](../reference/README.md)
<!-- /docs:nav -->
