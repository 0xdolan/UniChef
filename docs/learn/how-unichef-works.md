<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# How UniChef works

UniChef runs a **recipe**: a list of operations applied one after another to your input.
The value that flows through the recipe is called the **dish**. Each step takes the dish,
transforms it, and hands the result to the next step. The web app shows the dish after every
step, so you can see exactly where a decode went wrong.

## The dish has a type

A dish has a type. These are the ones operations produce:

| Type | What it holds | Made by, for example |
|---|---|---|
| string | Unicode text | [To Hex](../reference/ops/to-hex.md), [URL Decode](../reference/ops/url-decode.md) |
| bytes | raw octets | [From Base64](../reference/ops/from-base64.md), [Gzip](../reference/ops/gzip.md), [AES Encrypt](../reference/ops/aes-encrypt.md) |
| JSON | a structured value | [Parse URL](../reference/ops/parse-url.md), [JWT Decode](../reference/ops/jwt-decode.md) |
| table | rows and columns | [Analyse Characters](../reference/ops/analyse-characters.md), [Detect Invisible](../reference/ops/detect-invisible.md) |
| code points | a list of Unicode scalar values | [From Code Points](../reference/ops/from-code-points.md) |
| integer | a whole number | [Count](../reference/ops/count.md) |

Every operation declares the type it reads and the type it writes. When the dish has another
type, UniChef converts it along the shortest route:

- text to bytes: encode as UTF-8;
- bytes to text: decode as UTF-8, replacing each ill-formed sequence with U+FFFD
  REPLACEMENT CHARACTER;
- JSON to text: compact JSON; a table to text: tab-separated values; a table to JSON: an
  array of row objects.

So `From Base64` followed by `To Hex` shows the decoded bytes exactly, while `From Base64`
followed by `Unicode Case` treats them as UTF-8 text. The [text and bytes](text-and-bytes.md)
guide explains why that conversion matters.

## Input formats

The input box reads text by default. You can also paste hex or Base64 and choose that input
format: UniChef then turns your input into bytes before the first step, which is how you work
with binary data such as a captured packet or a ciphertext.

## Flow control

Some operations change the order of the recipe instead of the dish:

- [Fork](../reference/ops/fork.md) splits the input (by default on line breaks), runs its
  own steps on each part, and joins the results. Use it to decode a list of Base64 lines one
  by one.
- [Subsection](../reference/ops/subsection.md) runs its steps only on the parts of the text
  that match a regular expression and leaves the rest untouched.
- [Sub-recipe](../reference/ops/sub-recipe.md) groups steps so you can disable or reuse them
  together.
- [Label](../reference/ops/label.md), [Jump](../reference/ops/jump.md) and
  [Conditional Jump](../reference/ops/conditional-jump.md) build loops, for example "keep
  decoding Base64 until the output no longer looks like Base64". Every jump has a maximum
  count, so a recipe always ends.
- [Comment](../reference/ops/comment.md) holds a note and changes nothing.

A recipe can also stop at a **breakpoint** on a step, and a step can be **disabled** without
removing it.

## Two cores, one result

UniChef has two implementations of every operation, one in Python (the CLI and library) and
one in TypeScript (the web app, the extension and the npm package). Both are tested against
the same vectors in `spec/vectors/`, and the examples on every reference page are part of
those tests. A recipe therefore gives byte-for-byte the same output in a terminal as in a
browser.

## Offline by design

UniChef never sends your data anywhere. There is no server, no analytics and no network
request in any operation. The Unicode data comes from UniChef's own copy of the Unicode
Character Database, so results do not depend on the browser or the Python version.

## Recipes are portable

A recipe is a small JSON document, and **Copy link** in the web app packs the recipe and the
input into the URL fragment, which browsers never send to a server. Each reference page has
an "open this example" link built the same way. Recipes from CyberChef can be imported: see
[CyberChef operations and how they map](../upstream/cyberchef-operations.md).

<!-- docs:ops -->
Operations explained here: [Comment](../reference/ops/comment.md), [Conditional jump](../reference/ops/conditional-jump.md), [Fork](../reference/ops/fork.md), [Jump](../reference/ops/jump.md), [Label](../reference/ops/label.md), [Sub-recipe](../reference/ops/sub-recipe.md), [Subsection](../reference/ops/subsection.md).
<!-- /docs:ops -->

## Learn more

- [CyberChef](https://github.com/gchq/CyberChef), the project that made the recipe model
  popular.
- [JSON (RFC 8259)](https://www.rfc-editor.org/rfc/rfc8259), the format of recipes.

<!-- docs:nav -->
---

[← Documentation](../README.md) · [Contents](../README.md) · [Text and bytes →](text-and-bytes.md)
<!-- /docs:nav -->
