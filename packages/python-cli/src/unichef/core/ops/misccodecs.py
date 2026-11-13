# SPDX-License-Identifier: GPL-3.0-or-later
"""Small codecs: Caret/M-decode, Rison, NetBIOS names, Citrix CTX1 and Unicode text
formatting (PRD §3.8, 1.1).

Behaviour follows CyberChef v11.5.0 and rison.js 0.1.1 (Apache-2.0 and MIT), with the
deviations listed in spec/README.md: malformed input is an error instead of being read
as far as it makes sense.
"""

import re

from unichef.core.dish import JsonValue, format_float, json_dumps
from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    Example,
    OpContext,
    bool_arg,
    enum_arg,
    int_arg,
    operation,
)
from unichef.unicode.utf8 import encode as utf8_encode

CHECK_EVERY = 4096
MAX_DEPTH = 256
NETBIOS_NAME = 16
NIBBLE = 15
_ASCII_SPACE = " \t\n\v\f\r"


def _decode_error(message: str) -> UniChefError:
    return UniChefError("E_DECODE", message)


# ---------------------------------------------------------------------------
# Caret/M-decode

# `cat -v` notation: ^@..^_ and ^? for control bytes, M- for bytes with the high bit set.
_CARET_M = re.compile(r"M-\^[@-_?]|M-[ -~]|\^[@-_?]")


def _caret_m_byte(token: str) -> int:
    high = 0x80 if token.startswith("M-") else 0
    tail = token.removeprefix("M-")
    if tail.startswith("^") and len(tail) == 2:  # noqa: PLR2004  # ^ and one character
        return high | (0x7F if tail[1] == "?" else ord(tail[1]) - 0x40)
    return high | ord(tail)


@operation(
    "caret-m-decode",
    "Caret/M-decode",
    "Encoding",
    "string",
    "bytes",
    examples=(Example("M-bM-^@M-^] ^I!", {}, "\u201d \t!"),),
)
def caret_m_decode(text: str, _args: Args, ctx: OpContext) -> bytes:
    """Turn the caret and M- notation of `cat -v` back into bytes: `^@` to `^_` are 0x00 to
    0x1F, `^?` is 0x7F, and `M-` adds 0x80 to the character or caret code after it. Other
    text is kept as UTF-8."""
    out = bytearray()
    pos = 0
    for i, m in enumerate(_CARET_M.finditer(text)):
        if i % CHECK_EVERY == 0:
            ctx.check()
        out += text[pos : m.start()].encode("utf-8")
        out.append(_caret_m_byte(m.group()))
        pos = m.end()
    out += text[pos:].encode("utf-8")
    return bytes(out)


# ---------------------------------------------------------------------------
# Rison

_NOT_IDCHAR = " '!:(),*@$"
_ID = re.compile(r"[^-0-9 '!:(),*@$][^ '!:(),*@$]*")
_NUMBER_RUN = re.compile(r"[-0-9.eE]+")
_NUMBER = re.compile(r"-?[0-9]+(\.[0-9]+)?([eE]-?[0-9]+)?")
_MAX_INT_DIGITS = 4300


def _rison_string(s: str) -> str:
    if s == "":
        return "''"
    if _ID.fullmatch(s):
        return s
    return "'" + re.sub(r"(['!])", r"!\1", s) + "'"


def _rison(value: JsonValue, depth: int = 0) -> str:  # noqa: PLR0911  # one case per type
    if depth > MAX_DEPTH:
        raise UniChefError("E_LIMIT", f"The value is nested more than {MAX_DEPTH} deep.")
    match value:
        case None:
            return "!n"
        case bool():
            return "!t" if value else "!f"
        case int():
            return str(value)
        case float():
            return format_float(value).replace("+", "")
        case str():
            return _rison_string(value)
        case list():
            return "!(" + ",".join(_rison(v, depth + 1) for v in value) + ")"
        case dict():
            keys = sorted(value, key=lambda k: k.encode("utf-16-be"))  # JS sort order
            return (
                "("
                + ",".join(_rison_string(k) + ":" + _rison(value[k], depth + 1) for k in keys)
                + ")"
            )


# encodeURIComponent keeps A-Z a-z 0-9 - _ . ! ~ * ' ( ); rison.quote also keeps , : @ $ /.
_URI_KEEP = frozenset(
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'(),:@$/"
)


def _uri_quote(s: str) -> str:
    """rison.quote: encodeURIComponent, then give back , : @ $ / and space as +. A lone
    surrogate becomes U+FFFD first, as in any string output."""
    return "".join(
        "+" if b == 0x20 else chr(b) if b in _URI_KEEP else f"%{b:02X}"  # noqa: PLR2004
        for b in utf8_encode(s)
    )


@operation(
    "to-rison",
    "To Rison",
    "Data",
    "json",
    "string",
    (enum_arg("mode", ("value", "object", "array", "uri")),),
    examples=(Example('{"b":[1,true],"a":"x y"}', {}, "(a:'x y',b:!(1,!t))"),),
)
def to_rison(value: JsonValue, args: Args, _ctx: OpContext) -> str:
    """Write a JSON value as Rison, a compact form for URLs: objects as `(key:value)` with
    keys sorted, arrays as `!(...)`, `!t`, `!f` and `!n` for true, false and null, and
    strings quoted with `'` only when needed. `object` and `array` drop the outer brackets
    (O-Rison and A-Rison), and `uri` also escapes the result for a URL."""
    mode = args.text("mode")
    out = _rison(value)
    if mode == "object":
        if not isinstance(value, dict):
            raise UniChefError("E_INPUT_TYPE", "The `object` mode needs a JSON object.")
        return out[1:-1]
    if mode == "array":
        if not isinstance(value, list):
            raise UniChefError("E_INPUT_TYPE", "The `array` mode needs a JSON array.")
        return out[2:-1]
    return _uri_quote(out) if mode == "uri" else out


class _RisonParser:
    def __init__(self, text: str, ctx: OpContext) -> None:
        self.text = text
        self.pos = 0
        self.ctx = ctx
        self.steps = 0

    def fail(self, message: str) -> UniChefError:
        return _decode_error(f"{message} at position {self.pos}.")

    def next(self) -> str:
        if self.pos >= len(self.text):
            raise self.fail("Unexpected end of input")
        c = self.text[self.pos]
        self.pos += 1
        return c

    def value(self, depth: int) -> JsonValue:  # one case per token
        self.steps += 1
        if self.steps % CHECK_EVERY == 0:
            self.ctx.check()
        if depth > MAX_DEPTH:
            raise UniChefError("E_LIMIT", f"The value is nested more than {MAX_DEPTH} deep.")
        if self.pos >= len(self.text):
            raise self.fail("Expected a value")
        c = self.text[self.pos]
        if c == "!":
            self.pos += 1
            bang = self.next()
            if bang == "(":
                return self.items(depth)
            literals: dict[str, JsonValue] = {"t": True, "f": False, "n": None}
            if bang not in literals:
                self.pos -= 1
                raise self.fail(f"Unknown literal !{bang}")
            return literals[bang]
        if c == "(":
            self.pos += 1
            return self.object(depth)
        if c == "'":
            self.pos += 1
            return self.string()
        if c == "-" or (c.isascii() and c.isdigit()):
            return self.number()
        m = _ID.match(self.text, self.pos)
        if m is None:
            raise self.fail(f"Unexpected character {c!r}")
        self.pos = m.end()
        return m.group()

    def items(self, depth: int) -> list[JsonValue]:
        out: list[JsonValue] = []
        while self.peek() != ")":
            if out:
                self.expect(",")
            out.append(self.value(depth + 1))
        self.pos += 1
        return out

    def object(self, depth: int) -> dict[str, JsonValue]:
        out: dict[str, JsonValue] = {}
        while self.peek() != ")":
            if out:
                self.expect(",")
            start = self.pos
            key = self.value(depth + 1)
            if not isinstance(key, str):
                self.pos = start
                raise self.fail("An object key must be a string")
            self.expect(":")
            item = self.value(depth + 1)
            if key in out:
                self.ctx.warn("W_DUPLICATE_KEY", f"Duplicate Rison key {json_dumps(key)[:66]}.")
                del out[key]  # the last occurrence also takes the last position
            out[key] = item
        self.pos += 1
        return out

    def peek(self) -> str:
        if self.pos >= len(self.text):
            raise self.fail("Missing )")
        return self.text[self.pos]

    def expect(self, char: str) -> None:
        if self.peek() != char:
            raise self.fail(f"Expected {char!r}")
        self.pos += 1

    def string(self) -> str:
        parts: list[str] = []
        while True:
            if self.pos >= len(self.text):
                raise self.fail("Missing closing '")
            c = self.text[self.pos]
            self.pos += 1
            if c == "'":
                return "".join(parts)
            if c == "!":
                escaped = self.text[self.pos : self.pos + 1]
                if escaped not in ("!", "'"):
                    raise self.fail("A ! in a string must be followed by ! or '")
                self.pos += 1
                c = escaped
            parts.append(c)

    def number(self) -> JsonValue:
        m = _NUMBER_RUN.match(self.text, self.pos)
        token = m.group() if m else ""
        parsed = _NUMBER.fullmatch(token)
        if parsed is None:
            raise self.fail(f"Invalid number {token!r}")
        self.pos += len(token)
        if parsed.group(1) is None and parsed.group(2) is None:
            if len(token.lstrip("-")) > _MAX_INT_DIGITS:
                raise self.fail("The number has too many digits")
            return int(token)
        number = float(token)
        if number in (float("inf"), float("-inf")):
            raise self.fail(f"The number {token} is too large")
        return number


@operation(
    "from-rison",
    "From Rison",
    "Data",
    "string",
    "json",
    (enum_arg("mode", ("value", "object", "array")),),
    examples=(Example("(a:'x y',b:!(1,!t))", {}, '{"a":"x y","b":[1,true]}'),),
)
def from_rison(text: str, args: Args, ctx: OpContext) -> JsonValue:
    """Read Rison and write it as JSON. `object` and `array` read O-Rison and A-Rison, where
    the outer brackets are left out. Whitespace is not allowed between tokens."""
    mode = args.text("mode")
    source = {"object": f"({text})", "array": f"!({text})"}.get(mode, text)
    parser = _RisonParser(source, ctx)
    value = parser.value(0)
    if parser.pos != len(source):
        raise parser.fail("Unexpected text after the value")
    return value


# ---------------------------------------------------------------------------
# NetBIOS names (RFC 1001 first-level encoding)

_OFFSET = int_arg("offset", 65, 0, 240)


@operation(
    "encode-netbios-name",
    "Encode NetBIOS Name",
    "Encoding",
    "bytes",
    "bytes",
    (_OFFSET,),
    examples=(Example("UNICHEF", {}, "FFEOEJEDEIEFEGCACACACACACACACACA"),),
)
def encode_netbios_name(data: bytes, args: Args, _ctx: OpContext) -> bytes:
    """Pad the name with spaces to 16 bytes and write each byte as two, its high and low
    nibble each added to `offset` (65, `A`, by RFC 1001). The name may be at most 16
    bytes."""
    if len(data) > NETBIOS_NAME:
        raise _decode_error(f"A NetBIOS name is at most 16 bytes; the input has {len(data)}.")
    offset = args.integer("offset")
    out = bytearray()
    for b in data.ljust(NETBIOS_NAME, b" "):
        out += bytes(((b >> 4) + offset, (b & 0xF) + offset))
    return bytes(out)


@operation(
    "decode-netbios-name",
    "Decode NetBIOS Name",
    "Encoding",
    "bytes",
    "bytes",
    (_OFFSET,),
    examples=(Example("FFEOEJEDEIEFEGCACACACACACACACACA", {}, "UNICHEF"),),
)
def decode_netbios_name(data: bytes, args: Args, _ctx: OpContext) -> bytes:
    """Read pairs of bytes, each `offset` plus a nibble, as one byte each, and remove the
    trailing spaces. The input may be at most 32 bytes, in pairs."""
    if len(data) > 2 * NETBIOS_NAME or len(data) % 2:
        raise _decode_error("An encoded NetBIOS name is an even number of bytes, at most 32.")
    offset = args.integer("offset")
    nibbles = [b - offset for b in data]
    if any(not 0 <= n <= NIBBLE for n in nibbles):
        raise _decode_error(f"Every byte must be between {offset} and {offset + NIBBLE}.")
    return bytes(hi << 4 | lo for hi, lo in zip(nibbles[::2], nibbles[1::2], strict=True)).rstrip(
        b" "
    )


# ---------------------------------------------------------------------------
# Citrix CTX1


@operation(
    "citrix-ctx1-encode",
    "Citrix CTX1 Encode",
    "Encoding",
    "string",
    "string",
    examples=(Example("pass", {}, "NFHALEBBMHGCLEBB"),),
)
def citrix_ctx1_encode(text: str, _args: Args, ctx: OpContext) -> str:
    """Obscure a password the way Citrix CTX1 does: take its UTF-16LE bytes, XOR each with
    0xA5 and the previous result, and write each result as two letters from `A` to `P`.
    This is not encryption."""
    out = []
    previous = 0
    for i, b in enumerate(text.encode("utf-16-le", "surrogatepass")):
        if i % CHECK_EVERY == 0:
            ctx.check()
        previous = b ^ 0xA5 ^ previous
        out.append(chr(0x41 + (previous >> 4)) + chr(0x41 + (previous & 0xF)))
    return "".join(out)


_CTX1 = re.compile(r"(?:[A-P]{4})*")


@operation(
    "citrix-ctx1-decode",
    "Citrix CTX1 Decode",
    "Encoding",
    "string",
    "string",
    examples=(Example("NFHALEBBMHGCLEBB", {}, "pass"),),
)
def citrix_ctx1_decode(text: str, _args: Args, ctx: OpContext) -> str:
    """Reverse Citrix CTX1: read pairs of letters from `A` to `P` as bytes, XOR each with
    0xA5 and the byte before it, and read the result as UTF-16LE. ASCII whitespace around
    the input is ignored."""
    letters = text.strip(_ASCII_SPACE)
    if not _CTX1.fullmatch(letters):
        raise _decode_error("CTX1 text is letters A to P, a multiple of 4 long.")
    coded = [
        (ord(letters[i]) - 0x41) << 4 | (ord(letters[i + 1]) - 0x41)
        for i in range(0, len(letters), 2)
    ]
    out = bytearray()
    previous = 0
    for i, c in enumerate(coded):
        if i % CHECK_EVERY == 0:
            ctx.check()
        out.append(c ^ 0xA5 ^ previous)
        previous = c
    try:
        return out.decode("utf-16-le")
    except UnicodeDecodeError:
        raise _decode_error("The decoded bytes are not valid UTF-16LE.") from None


# ---------------------------------------------------------------------------
# Unicode text format

_LINE_BREAKS = "\n\r"


@operation(
    "unicode-text-format",
    "Unicode Text Format",
    "Text",
    "string",
    "string",
    (bool_arg("underline"), bool_arg("strikethrough")),
    examples=(Example("abc", {"underline": True}, "a̲b̲c̲"),),
)
def unicode_text_format(text: str, args: Args, _ctx: OpContext) -> str:
    """Draw a line through or under text by adding a combining mark after every character
    except line breaks: U+0336 for `strikethrough`, then U+0332 for `underline`."""
    marks = ("̶" if args.flag("strikethrough") else "") + ("̲" if args.flag("underline") else "")
    if not marks:
        return text
    return "".join(c if c in _LINE_BREAKS else c + marks for c in text)
