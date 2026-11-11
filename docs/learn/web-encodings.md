<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Web encodings

Web protocols reserve some characters for their own syntax: `?` and `&` in a URL, `<` and
`&` in HTML, `=` in email bodies, the dot in a domain name. Each format has an **escape**
mechanism so that data containing those characters, or characters outside ASCII, can still be
carried. Getting the escape wrong is the root of injection bugs, and decoding it in the
wrong order is a classic filter bypass.

## Percent-encoding (URLs)

A URL may contain only a limited set of ASCII characters. Everything else is written as `%`
followed by two hex digits, **one escape per UTF-8 byte** (RFC 3986 §2.1).

**Worked example: `café au lait`**

1. Encode as UTF-8: `63 61 66 c3 a9 20 61 75 20 6c 61 69 74`.
2. Keep the unreserved bytes (`A–Z a–z 0–9 - . _ ~`) as they are.
3. Write every other byte as `%XX`: `c3 a9` becomes `%C3%A9`, the space `20` becomes `%20`.

Result: `caf%C3%A9%20au%20lait`.

[URL Encode](../reference/ops/url-encode.md) has three modes. `component` escapes everything
except the unreserved characters, like JavaScript's `encodeURIComponent`, and is right for a
single query value or path segment. `reserved-only` escapes only the RFC 3986 reserved characters
(`: / ? # [ ] @ ! $ & ' ( ) * + , ; =`, plus `%` itself) and leaves everything else, spaces and non-ASCII
included, as it is: use it to neutralise URL syntax inside text. `all` escapes every byte,
letters too, which is how obfuscated URLs in phishing mail often look.

HTML forms use a variant (`application/x-www-form-urlencoded`) where a space is `+`. That is
why [URL Decode](../reference/ops/url-decode.md) has a `plus-as-space` option and
[Parse Query String](../reference/ops/parse-query-string.md) treats `+` as a space by default.

**Security notes.** Decoding twice turns `%252e%252e%252f` into `%2e%2e%2f` and then `../`,
so a filter that checks the once-decoded value can be bypassed if a later layer decodes
again. Overlong UTF-8 such as `%c0%af` for `/` was a famous IIS path traversal. Decode once,
then validate.

## HTML character references

HTML gives `&`, `<`, `>` and quotes special meaning. A **character reference** writes a
character safely: named (`&eacute;`, `&lt;`), decimal (`&#233;`) or hex (`&#xE9;`).
[HTML Entity Encode](../reference/ops/html-entity-encode.md) escapes the five special
characters `& < > " '` (enough to prevent HTML injection in text and quoted attribute values),
or every non-ASCII character as well, or everything.

Decoding follows the HTML parser, which is forgiving: `&amp` without a semicolon still works
for legacy names, `&#150;` means `–` because 0x80–0x9F are read as Windows-1252, and invalid
numbers become U+FFFD. [HTML Entity Decode](../reference/ops/html-entity-decode.md) copies
those rules, so it shows what a browser would render. Attackers use the same tolerance to
hide `javascript:` in links as `&#106;avascript:`.

## Quoted-printable

Email bodies were designed for 7-bit ASCII lines of limited length. **Quoted-printable**
(RFC 2045 §6.7) keeps printable ASCII as it is and writes other bytes as `=` plus two
upper-case hex digits, so mostly-English text stays readable: `café` becomes `caf=C3=A9`. A
literal `=` becomes `=3D`. Lines are at most 76 characters; a longer line is split with a
**soft line break**, an `=` at the end of the line, which the decoder removes. See
[Quoted-Printable Encode](../reference/ops/quoted-printable-encode.md) and
[Quoted-Printable Decode](../reference/ops/quoted-printable-decode.md). Phishing mail often
hides its links in quoted-printable or Base64 bodies.

## Punycode and IDNA

The DNS only allows letters, digits and hyphens in a label. **Internationalised domain
names** (IDNs) such as `bücher.example` are stored as ASCII with **Punycode** (RFC 3492)
behind an `xn--` prefix: `xn--bcher-kva.example`.

**How Punycode works.** It copies the ASCII characters first (`bcher`), adds a `-`, and then
encodes each non-ASCII character as a number that says *which character* and *where to
insert it*. Those numbers are written in a variable-length base-36 code (`a–z` and `0–9`)
with an adaptive bias, so short labels give short output. For `bücher`, the one insertion
(`ü`, U+00FC, at position 1) encodes as `kva`.

[To Punycode](../reference/ops/to-punycode.md) and [From Punycode](../reference/ops/from-punycode.md)
apply only that algorithm. Real domain names also need **IDNA** processing (UTS #46): map
the name (lower-case it, fold full-width characters, and so on), normalise it to NFC, check
each label against the rules for hyphens, bidi text and joiners, and only then Punycode it.
[IDNA to ASCII](../reference/ops/idna-to-ascii.md) does all of that, so `Bücher.Example` and
`ｂüｃｈｅｒ.example` both become `xn--bcher-kva.example`, and
[IDNA to Unicode](../reference/ops/idna-to-unicode.md) shows what a browser would display.

**Security notes.** IDNs make homograph attacks possible: `xn--pypal-4ve.com` displays as
`pаypal.com` with a Cyrillic `а`. Browsers show the `xn--` form when a label mixes scripts in
a suspicious way. To check a domain, convert it with IDNA to Unicode and run
[Detect Confusables](../reference/ops/detect-confusables.md) and
[Script Mix Check](../reference/ops/script-mix-check.md): see [Unicode security](unicode-security.md).

<!-- docs:ops -->
Operations explained here: [From Punycode](../reference/ops/from-punycode.md), [HTML Entity Decode](../reference/ops/html-entity-decode.md), [HTML Entity Encode](../reference/ops/html-entity-encode.md), [IDNA To ASCII](../reference/ops/idna-to-ascii.md), [IDNA To Unicode](../reference/ops/idna-to-unicode.md), [Quoted-Printable Decode](../reference/ops/quoted-printable-decode.md), [Quoted-Printable Encode](../reference/ops/quoted-printable-encode.md), [To Punycode](../reference/ops/to-punycode.md), [URL Decode](../reference/ops/url-decode.md), [URL Encode](../reference/ops/url-encode.md).
<!-- /docs:ops -->

## Learn more

- [RFC 3986: URI syntax](https://www.rfc-editor.org/rfc/rfc3986)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [HTML Standard: character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)
- [RFC 2045 §6.7: quoted-printable](https://www.rfc-editor.org/rfc/rfc2045#section-6.7)
- [RFC 3492: Punycode](https://www.rfc-editor.org/rfc/rfc3492)
- [UTS #46: IDNA compatibility processing](https://www.unicode.org/reports/tr46/)
- [OWASP: double encoding](https://owasp.org/www-community/Double_Encoding)

<!-- docs:nav -->
---

[← Base encodings](base-encodings.md) · [Contents](../README.md) · [Hashing →](hashing.md)
<!-- /docs:nav -->
