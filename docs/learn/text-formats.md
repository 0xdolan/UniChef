<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Text formats: hexdumps, escapes and identifier cases

Some text formats exist so that people can read data a program would rather keep as bytes, or
so that text can go somewhere with stricter rules: a source file, a rule file, a terminal or a
narrow column. This guide covers the ones you meet most while debugging or writing code.

## Hexdumps

A hexdump shows bytes three ways at once: the offset of each line, the bytes in hex, and the
same bytes as text. [To Hexdump](../reference/ops/to-hexdump.md) writes the classic
`hexdump -C` layout, 16 bytes per line by default:

```
00000000  48 69 20 e2 82 ac 20 6f  |Hi â.¬ o|
00000008  6b 0a 21                 |k.!|
```

That is `Hi € ok`, a line feed and `!` at 8 bytes per line. The text column reads each byte as
Latin-1, so the three UTF-8 bytes of `€` show as `â.¬`: a hexdump shows bytes, not characters.
Bytes that would print as nothing, such as controls, show as dots.

[From Hexdump](../reference/ops/from-hexdump.md) reads the hex columns back and ignores the
offset and the text column. It accepts the layouts of `xxd`, `hexdump -C`, Wireshark and the
010 Editor. Check the result: a text column that happens to look like hex can be read as data.

## Snort hex content

Snort and Suricata rules match payloads with `content:"…"`, where printable text is written
as is and other bytes go between pipes as hex. [To Hex Content](../reference/ops/to-hex-content.md)
turns `GET /a b` and CR LF into `GET |2f|a b|0d0a|`; `all` writes every byte as hex.
[From Hex Content](../reference/ops/from-hex-content.md) reads it back.

## String escapes

A string in source code cannot hold every character directly: the quote would end it and a
line feed would break the line. [Escape String](../reference/ops/escape-string.md) writes such
characters as backslash escapes, the way the jsesc library does for JavaScript:

| Input | `special` (default) | `minimal` | `json` with double quotes |
|---|---|---|---|
| `It's`, tab, `"é"`, 😀 | `It\'s\t"\xe9"\u{1f600}` | `It\'s\t"é"😀` | `"It's\t\"é\"\u{1f600}"` |

`special` keeps only printable ASCII, so the output is safe in any file encoding. `minimal`
escapes only what would break the string. `es6` (on by default) writes characters past U+FFFF
as `\u{…}`; turn it off for the older surrogate pair form `😀`.

[Unescape String](../reference/ops/unescape-string.md) goes the other way. It understands
`\n`, `\t` and the other single-letter escapes, octal `\101`, hex `\x41`, `é` and
`\u{1F600}`, and combines a surrogate pair written as two `\u` escapes into one character.

## Identifier cases

Programming languages and file formats each prefer a style for names made of several words:
`snake_case` in Python, `kebab-case` in URLs and CSS, `camelCase` in JavaScript.
[To Snake case](../reference/ops/to-snake-case.md), [To Kebab case](../reference/ops/to-kebab-case.md)
and [To Camel case](../reference/ops/to-camel-case.md) first split the text into words and then
join them in the chosen style:

| Input | Snake | Kebab | Camel |
|---|---|---|---|
| `parseHTTPResponse v2` | `parse_http_response_v_2` | `parse-http-response-v-2` | `parseHttpResponseV2` |

A word breaks where a lower-case letter meets an upper-case one, before the last capital of an
acronym (`HTTPResponse` is `HTTP` and `Response`) and between letters and digits. Letters of
every script count, using the Unicode character database, so `Ça va? l'été` becomes
`ça_va_lété`; apostrophes are dropped. With `context_aware`, only names outside double-quoted
strings change, which is handy for a line of code.

## Smart characters and wrapping

Word processors replace straight quotes with curly ones, `--` with a dash and `...` with an
ellipsis. Pasted into a terminal, a config file or code, these break things.
[Escape Smart Characters](../reference/ops/escape-smart-characters.md) turns them back into
ASCII: `“Hi” — it’s 3×4… ©` becomes `"Hi" -- it's 3x4... (c)`. Other non-ASCII characters can be
kept, removed or replaced with a dot.

[Wrap](../reference/ops/wrap.md) breaks long lines at a fixed number of characters, such as 64
for PEM-style Base64 or 76 for MIME. It does not look for spaces: it counts characters.

<!-- docs:ops -->
Operations explained here: [Escape String](../reference/ops/escape-string.md), [From Hex Content](../reference/ops/from-hex-content.md), [From Hexdump](../reference/ops/from-hexdump.md), [To Hex Content](../reference/ops/to-hex-content.md), [To Hexdump](../reference/ops/to-hexdump.md), [Unescape String](../reference/ops/unescape-string.md), [Escape Smart Characters](../reference/ops/escape-smart-characters.md), [To Camel case](../reference/ops/to-camel-case.md), [To Kebab case](../reference/ops/to-kebab-case.md), [To Snake case](../reference/ops/to-snake-case.md), [Wrap](../reference/ops/wrap.md).
<!-- /docs:ops -->

## Learn more

- [hexdump(1) manual page](https://man7.org/linux/man-pages/man1/hexdump.1.html)
- [Snort 3 rule writing: content](https://docs.snort.org/rules/options/payload/content)
- [jsesc](https://github.com/mathiasbynens/jsesc)
- [Escape sequences in JavaScript strings (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences)
- [Naming conventions on Wikipedia](https://en.wikipedia.org/wiki/Naming_convention_(programming))

<!-- docs:nav -->
---

[← Data formats and text processing](data-and-text.md) · [Contents](../README.md) · [Operation reference →](../reference/README.md)
<!-- /docs:nav -->
