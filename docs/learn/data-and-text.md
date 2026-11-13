<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Data formats and text processing

Between decoding and analysing, most recipes need to reshape data: pretty-print JSON,
convert a CSV export, pull the parameters out of a URL, extract every email address from a
log, sort and count lines. These operations do that, and they are Unicode-aware, so they
treat `é` and `👋🏽` as the characters a reader sees.

## JSON

JSON (RFC 8259) is objects `{}`, arrays `[]`, strings, numbers, `true`, `false` and `null`.
[JSON Beautify](../reference/ops/json-beautify.md) writes one value per line so a minified API
response becomes readable, and can sort keys so two documents can be compared line by line.
[JSON Minify](../reference/ops/json-minify.md) removes all whitespace. Both parse the input
first, so they also tell you whether it is valid JSON.

## CSV

CSV (RFC 4180) separates fields with commas and records with CRLF. A field that contains a
comma, a quote or a line break is wrapped in double quotes, and a quote inside it is doubled:
`"say ""hi"""`. [CSV to JSON](../reference/ops/csv-to-json.md) parses that correctly, which a
naive split on commas does not, and [JSON to CSV](../reference/ops/json-to-csv.md) writes it.

**Security note: CSV injection.** A cell that starts with `=`, `+`, `-` or `@` runs as a
formula when the file is opened in a spreadsheet. If you export user data to CSV for people
to open in Excel, neutralise such cells.

## URLs and query strings

A URL has up to eight parts (RFC 3986):

```
https://zoë:pw@example.com:8443/a/b?q=1#top
└─┬─┘   └┬┘ └┬┘ └────┬────┘ └┬─┘└─┬─┘ └┬┘ └┬┘
scheme  user pass   host    port path query fragment
```

[Parse URL](../reference/ops/parse-url.md) splits a URL into those parts exactly as written,
without decoding, which matters when you analyse a phishing link: `https://example.com@evil.test/`
has the host `evil.test`, and `example.com` is only a user name.
[Parse Query String](../reference/ops/parse-query-string.md) turns `?q=caf%C3%A9&tag=a&tag=b`
into `{"q":"café","tag":["a","b"]}`.

## Regular expressions

A regular expression describes a pattern of text. UniChef uses one **portable regex
profile** in both cores, so a pattern matches the same text in the CLI and the browser. It
follows familiar JavaScript and Perl syntax and is always Unicode-aware:
- `.`, `\d`, `\w` and `\s` work on code points, not UTF-16 units;
- property classes such as `\p{Script=Cyrillic}` or `\p{Lu}` use UniChef's Unicode data;
- the flags are `i` (ignore case, with Unicode case folding), `m` (`^` and `$` match at line
  breaks), `s` (`.` matches line breaks) and `x` (ignore whitespace and `#` comments in the
  pattern);
- a pattern that the profile does not support is refused with an error rather than matched
  differently by the two cores, and a slow pattern stops with a timeout.

- [Regex Extract](../reference/ops/regex-extract.md) lists every match, or one capture group:
  extract email addresses, IPs, hashes or URLs from a log.
- [Find / Replace](../reference/ops/find-replace.md) rewrites matches, with `$1` for groups:
  `(\d+)-(\d+)-(\d+)` → `$3/$2/$1` turns `2026-11-07` into `07/11/2026`.
- [Subsection](../reference/ops/subsection.md) runs other operations only on the matches.

The web app's Regex lab tests a pattern against sample text and highlights every match.

## Lines and lists

These operations treat the text as lines separated by LF:
- [Sort Lines](../reference/ops/sort-lines.md) by code point, case-insensitively, numerically
  or by length;
- [Unique Lines](../reference/ops/unique-lines.md), optionally with a count of each, like
  `sort | uniq -c`;
- [Head](../reference/ops/head.md) and [Tail](../reference/ops/tail.md);
- [Trim](../reference/ops/trim.md);
- [Split](../reference/ops/split.md) and [Join](../reference/ops/join.md), to turn a
  comma-separated list into lines and back.

[Reverse](../reference/ops/reverse.md) reverses the order of characters, code points or bytes.

[Add line numbers](../reference/ops/add-line-numbers.md) and
[Remove line numbers](../reference/ops/remove-line-numbers.md) number a listing and undo it;
[Pad lines](../reference/ops/pad-lines.md) indents every line or fills it on the right.

## Cleaning up text

Text copied from a terminal, a web page or a binary file often carries extra material:
- [Remove ANSI escape codes](../reference/ops/remove-ansi-escape-codes.md) drops terminal
  colour and cursor sequences such as `ESC[31m`;
- [Strip HTML tags](../reference/ops/strip-html-tags.md) keeps the text between tags and tidies
  the blank lines left behind (it does not decode `&amp;`; follow it with
  [HTML entity decode](../reference/ops/html-entity-decode.md));
- [Remove null bytes](../reference/ops/remove-null-bytes.md) drops 0x00 bytes, which turns
  ASCII stored as UTF-16 back into readable text.

## Changing case

[Unicode Case](../reference/ops/unicode-case.md) upper-, lower- or title-cases text. Three
more operations play with case one character at a time:
- [Swap case](../reference/ops/swap-case.md): `Hello` → `hELLO`;
- [Alternating caps](../reference/ops/alternating-caps.md): `Hello world` → `hElLo WoRlD`;
- [Get all casings](../reference/ops/get-all-casings.md): every mix of upper and lower case,
  one per line (`ab` → `ab`, `Ab`, `aB`, `AB`).

They use full Unicode case mappings, so `ß` upper-cases to `SS`.

**Unicode-aware means:**
- case-insensitive comparison uses full case folding (`STRASSE` equals `straße`);
- trimming removes every Unicode White_Space character, not just ASCII spaces;
- reversing by graphemes keeps `👋🏽` and `é` intact.

See [Unicode](unicode.md).

<!-- docs:ops -->
Operations explained here: [CSV to JSON](../reference/ops/csv-to-json.md), [JSON Beautify](../reference/ops/json-beautify.md), [JSON Minify](../reference/ops/json-minify.md), [JSON to CSV](../reference/ops/json-to-csv.md), [Parse Query String](../reference/ops/parse-query-string.md), [Parse URL](../reference/ops/parse-url.md), [Add line numbers](../reference/ops/add-line-numbers.md), [Alternating caps](../reference/ops/alternating-caps.md), [Find / replace](../reference/ops/find-replace.md), [Get all casings](../reference/ops/get-all-casings.md), [Head](../reference/ops/head.md), [Join lines](../reference/ops/join.md), [Pad lines](../reference/ops/pad-lines.md), [Regex extract](../reference/ops/regex-extract.md), [Remove ANSI escape codes](../reference/ops/remove-ansi-escape-codes.md), [Remove line numbers](../reference/ops/remove-line-numbers.md), [Remove null bytes](../reference/ops/remove-null-bytes.md), [Reverse](../reference/ops/reverse.md), [Sort lines](../reference/ops/sort-lines.md), [Split](../reference/ops/split.md), [Strip HTML tags](../reference/ops/strip-html-tags.md), [Swap case](../reference/ops/swap-case.md), [Tail](../reference/ops/tail.md), [Trim](../reference/ops/trim.md), [Unique lines](../reference/ops/unique-lines.md).
<!-- /docs:ops -->

## Learn more

- [RFC 8259: JSON](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 4180: CSV](https://www.rfc-editor.org/rfc/rfc4180)
- [RFC 3986: URI syntax](https://www.rfc-editor.org/rfc/rfc3986)
- [MDN: regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions)
- [OWASP: CSV injection](https://owasp.org/www-community/attacks/CSV_Injection)
- [ANSI escape code (Wikipedia)](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [Unicode case mapping FAQ](https://www.unicode.org/faq/casemap_charprop.html)

<!-- docs:nav -->
---

[← Unicode security](unicode-security.md) · [Contents](../README.md) · [Text formats: hexdumps, escapes and identifier cases →](text-formats.md)
<!-- /docs:nav -->
