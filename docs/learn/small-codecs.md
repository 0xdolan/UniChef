<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks

Some formats come up in only one corner of computing: a terminal dump, a URL that holds an
object, a packet capture, a configuration file. Each is small and easy to undo once you know
the rule. This page covers five of them.

## Caret and M- notation (`cat -v`)

`cat -v` and `less` show bytes that would upset a terminal as printable text. A control byte
0x00 to 0x1F is written `^` plus the character 0x40 above it, so a tab (0x09) is `^I` and a
line feed (0x0A) is `^J`. The delete byte 0x7F is `^?`. A byte with the high bit set is `M-`
plus the notation for the byte 0x80 below it, so 0xC3 is `M-C` and 0x89 is `M-^I`.

UTF-8 text therefore turns into strings of `M-`: `é` is the bytes C3 A9, shown as `M-CM-)`.
[Caret/M-decode](../reference/ops/caret-m-decode.md) turns the notation back into the bytes.
A `^` or `M-` that is not part of a valid sequence is kept as it is.

## Rison

Rison writes JSON so that it reads well in a URL: no double quotes, and few characters that
need escaping. Kibana, for example, keeps its dashboard state in Rison.

| JSON | Rison |
|---|---|
| `{"a":1,"b":"x y"}` | `(a:1,b:'x y')` |
| `[1,2]` | `!(1,2)` |
| `true`, `false`, `null` | `!t`, `!f`, `!n` |
| `"it's"` | `'it!'s'` |

A string that looks like a plain word is written without quotes. Inside quotes, `!` escapes
`'` and `!` itself. O-Rison and A-Rison leave out the outer brackets of an object or an array,
for a query string like `?a:1,b:2`.

[To Rison](../reference/ops/to-rison.md) writes Rison from JSON and sorts the keys, so equal
objects give equal text. Its `uri` mode also escapes the result for a URL.
[From Rison](../reference/ops/from-rison.md) reads it back. UniChef's reader is strict: no
whitespace between tokens, and only numbers in JSON's form.

## NetBIOS names

In NetBIOS over TCP/IP (RFC 1001), a computer name is padded with spaces to 16 bytes, and each
byte is split into two halves of 4 bits. Each half is added to `A`, so it becomes a letter from
`A` to `P`. The result is 32 letters that fit the rules for a DNS label:

```text
U (0x55) → F F      space (0x20) → C A
UNICHEF  → FFEOEJEDEIEFEGCACACACACACACACACA
```

You see these names in packet captures of NetBIOS name service and SMB traffic. A run of
`CACA…` at the end is the padding.
[Encode NetBIOS Name](../reference/ops/encode-netbios-name.md) and
[Decode NetBIOS Name](../reference/ops/decode-netbios-name.md) convert in both directions.

## Citrix CTX1

Older Citrix products store passwords in configuration files in the CTX1 form. It is not
encryption: there is no key, and anyone can undo it. Each byte of the password's UTF-16LE
encoding is XORed with 0xA5 and with the previous result, then written as two letters from
`A` to `P`, one for each half of the byte:

```text
p = 0x70:      0x70 XOR 0xA5 XOR 0x00 = 0xD5 → N F
0x00 (high):   0x00 XOR 0xA5 XOR 0xD5 = 0x70 → H A
pass → NFHALEBBMHGCLEBB
```

[Citrix CTX1 Decode](../reference/ops/citrix-ctx1-decode.md) recovers the password, and
[Citrix CTX1 Encode](../reference/ops/citrix-ctx1-encode.md) makes the form for testing.
Treat a password found this way as exposed.

## Lines through and under text

Plain text has no bold or underline, but Unicode has **combining marks**, which draw on the
character before them. U+0332 COMBINING LOW LINE draws a line under it, and U+0336 COMBINING
LONG STROKE OVERLAY draws a line through it.
[Unicode Text Format](../reference/ops/unicode-text-format.md) puts a mark after every
character, so `abc` becomes `a̲b̲c̲`, which keeps its look when pasted into a chat or a social
media post.

The result is no longer the same text: search, sorting and screen readers see the extra
marks. [Strip Diacritics](../reference/ops/strip-diacritics.md) takes them off again. For
more on how characters and marks combine, see [Unicode](unicode.md).

<!-- docs:ops -->
Operations explained here: [Caret/M-decode](../reference/ops/caret-m-decode.md), [Citrix CTX1 Decode](../reference/ops/citrix-ctx1-decode.md), [Citrix CTX1 Encode](../reference/ops/citrix-ctx1-encode.md), [Decode NetBIOS Name](../reference/ops/decode-netbios-name.md), [Encode NetBIOS Name](../reference/ops/encode-netbios-name.md), [From Rison](../reference/ops/from-rison.md), [To Rison](../reference/ops/to-rison.md), [Unicode Text Format](../reference/ops/unicode-text-format.md).
<!-- /docs:ops -->

## Learn more

- [cat(1) and the -v option](https://www.gnu.org/software/coreutils/manual/html_node/cat-invocation.html)
- [Rison on GitHub](https://github.com/Nanonid/rison)
- [RFC 1001, NetBIOS over TCP/UDP](https://www.rfc-editor.org/rfc/rfc1001)
- [Combining characters on Wikipedia](https://en.wikipedia.org/wiki/Combining_character)

<!-- docs:nav -->
---

[← Sets and distances: comparing lists and strings](sets-and-distances.md) · [Contents](../README.md) · [Operation reference →](../reference/README.md)
<!-- /docs:nav -->
