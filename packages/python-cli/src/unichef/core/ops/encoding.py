# SPDX-License-Identifier: GPL-3.0-or-later
"""Encoding operations (PRD §3.8 Alpha; semantics in spec/README.md)."""

import re
from typing import Literal

from unichef.core.dish import MAX_CODE_POINT
from unichef.core.errors import UniChefError
from unichef.core.registry import Args, OpContext, bool_arg, enum_arg, operation, string_arg
from unichef.unicode import utf8

CHECK_EVERY = 64 * 1024
BYTE_BITS = 8
_ASCII_END = 0x80
_SUPPLEMENTARY = 0x10000
_W1252_RANGE = range(0x80, 0xA0)


def _decode_error(what: str) -> UniChefError:
    return UniChefError("E_DECODE", what)


# ---------------------------------------------------------------------------
# Radix-2^n codecs shared by Base64 and Base32


def _encode_radix(data: bytes, alphabet: str, bits: int, ctx: OpContext) -> str:
    out: list[str] = []
    acc = 0
    held = 0
    mask = (1 << bits) - 1
    for i, byte in enumerate(data):
        if i % CHECK_EVERY == 0:
            ctx.check()
        acc = ((acc << 8) | byte) & 0xFFFF
        held += 8
        while held >= bits:
            held -= bits
            out.append(alphabet[(acc >> held) & mask])
    if held:
        out.append(alphabet[(acc << (bits - held)) & mask])
    return "".join(out)


def _decode_radix(chars: str, index: dict[str, int], bits: int, *, strict: bool) -> bytes:
    """Decode alphabet characters; trailing bits must be < ``bits`` (zero when strict)."""
    out = bytearray()
    acc = 0
    held = 0
    for ch in chars:
        acc = ((acc << bits) | index[ch]) & 0xFFFF
        held += bits
        if held >= BYTE_BITS:
            held -= BYTE_BITS
            out.append((acc >> held) & 0xFF)
    if held >= bits:
        raise _decode_error("The input ends with an incomplete group.")
    if strict and acc & ((1 << held) - 1):
        raise _decode_error("The unused trailing bits are not zero.")
    return bytes(out)


def _strict_body(text: str, pad: str, group: int, alphabet: dict[str, int]) -> str:
    body = text.rstrip(pad) if pad else text
    pads = len(text) - len(body)
    if len(text) % group or any(ch not in alphabet for ch in body):
        raise _decode_error("Strict mode: the input is not canonical.")
    expected = -len(body) % group
    if pads != expected:
        raise _decode_error("Strict mode: the padding is wrong.")
    return body


# ---------------------------------------------------------------------------
# Base64

B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
B64URL = B64[:62] + "-_"
B64_ALPHABETS = ("standard", "url", "custom")


def _b64_alphabet(args: Args) -> tuple[str, str]:
    choice = args.text("alphabet")
    if choice == "standard":
        return B64, "="
    if choice == "url":
        return B64URL, "="
    custom = args.text("custom")
    if len(custom) not in (64, 65) or len(set(custom)) != len(custom):
        raise UniChefError(
            "E_ARG_INVALID",
            "A custom Base64 alphabet needs 64 unique characters and an optional pad.",
        )
    return custom[:64], custom[64] if len(custom) == 65 else "="  # noqa: PLR2004


@operation(
    "to-base64",
    "To Base64",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("alphabet", B64_ALPHABETS), string_arg("custom"), bool_arg("padding", True)),
)
def to_base64(data: bytes, args: Args, ctx: OpContext) -> str:
    """Encode bytes as Base64 (RFC 4648 §4 or §5, or a custom alphabet)."""
    alphabet, pad = _b64_alphabet(args)
    text = _encode_radix(data, alphabet, 6, ctx)
    if args.flag("padding"):
        text += pad * (-len(text) % 4)
    return text


@operation(
    "from-base64",
    "From Base64",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("alphabet", B64_ALPHABETS), string_arg("custom"), bool_arg("strict")),
)
def from_base64(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode Base64. Without `strict`, characters outside the alphabet are skipped."""
    alphabet, pad = _b64_alphabet(args)
    index = {ch: i for i, ch in enumerate(alphabet)}
    ctx.check()
    strict = args.flag("strict")
    chars = (
        _strict_body(text, pad, 4, index) if strict else "".join(ch for ch in text if ch in index)
    )
    return _decode_radix(chars, index, 6, strict=strict)


# ---------------------------------------------------------------------------
# Base32

B32 = {"rfc4648": "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", "hex": "0123456789ABCDEFGHIJKLMNOPQRSTUV"}
B32_TAILS = frozenset({0, 2, 4, 5, 7})


@operation(
    "to-base32",
    "To Base32",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("alphabet", tuple(B32)), bool_arg("padding", True)),
)
def to_base32(data: bytes, args: Args, ctx: OpContext) -> str:
    """Encode bytes as Base32 (RFC 4648 §6) or base32hex (§7)."""
    text = _encode_radix(data, B32[args.text("alphabet")], 5, ctx)
    if args.flag("padding"):
        text += "=" * (-len(text) % 8)
    return text


@operation(
    "from-base32",
    "From Base32",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("alphabet", tuple(B32)), bool_arg("strict")),
)
def from_base32(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode Base32. Without `strict`, it is case-insensitive and skips other characters."""
    alphabet = B32[args.text("alphabet")]
    index = {ch: i for i, ch in enumerate(alphabet)}
    ctx.check()
    strict = args.flag("strict")
    if strict:
        chars = _strict_body(text, "=", 8, index)
    else:
        upper = {ch.lower(): i for ch, i in index.items() if ch.isalpha()}
        chars = "".join(
            ch if ch in index else ch.upper() for ch in text if ch in index or ch in upper
        )
    if len(chars) % 8 not in B32_TAILS:
        raise _decode_error("The input ends with an incomplete Base32 group.")
    return _decode_radix(chars, index, 5, strict=strict)


# ---------------------------------------------------------------------------
# Hex

HEX_DELIMITERS = {"none": "", "space": " ", "comma": ",", "colon": ":", "newline": "\n"}
HEX_PREFIXES = ("0x", "\\x")
HEX_CHOICES = (*HEX_DELIMITERS, *HEX_PREFIXES)
_AUTO_PREFIX = re.compile(r"0[xX]|\\x")
_AUTO_SEPARATOR = re.compile(r"[\t\n\v\f\r ,:;-]")
_HEX_PAIR = re.compile(r"[0-9a-fA-F]{2}")
_HEX_DIGITS = re.compile(r"(?:[0-9a-fA-F]{2})*")


@operation(
    "to-hex",
    "To Hex",
    "Encoding",
    "bytes",
    "string",
    (
        enum_arg("delimiter", HEX_CHOICES, "space"),
        enum_arg("case", ("lower", "upper")),
    ),
)
def to_hex(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write each byte as two hex digits, separated or prefixed by `delimiter`."""
    ctx.check()
    delimiter = args.text("delimiter")
    digits = data.hex()
    if args.text("case") == "upper":
        digits = digits.upper()
    pairs = [digits[i : i + 2] for i in range(0, len(digits), 2)]
    if delimiter in HEX_PREFIXES:
        return "".join(delimiter + p for p in pairs)
    return HEX_DELIMITERS[delimiter].join(pairs)


@operation(
    "from-hex",
    "From Hex",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("delimiter", ("auto", *HEX_CHOICES)),),
)
def from_hex(text: str, args: Args, ctx: OpContext) -> bytes:
    """Read hex digit pairs. `auto` strips 0x and \\x prefixes, whitespace and ,:;-."""
    ctx.check()
    delimiter = args.text("delimiter")
    if delimiter == "auto":
        digits = _AUTO_SEPARATOR.sub("", _AUTO_PREFIX.sub("", text))
        if not _HEX_DIGITS.fullmatch(digits):
            raise _decode_error("The input holds a non-hex character or an odd digit count.")
        return bytes.fromhex(digits)
    if text == "":
        return b""
    if delimiter in HEX_PREFIXES:
        tokens = text.split(delimiter)
        if tokens[0] != "":
            raise _decode_error(f"Every byte must start with {delimiter}.")
        tokens = tokens[1:]
    elif delimiter == "none":
        if len(text) % 2:
            raise _decode_error("The input has an odd number of hex digits.")
        tokens = [text[i : i + 2] for i in range(0, len(text), 2)]
    else:
        tokens = text.split(HEX_DELIMITERS[delimiter])
    if not all(_HEX_PAIR.fullmatch(t) for t in tokens):
        raise _decode_error("Every byte must be exactly two hex digits.")
    return bytes(int(t, 16) for t in tokens)


# ---------------------------------------------------------------------------
# Binary, octal and decimal bytes

RADIX_DELIMITERS = {"space": " ", "comma": ",", "colon": ":", "newline": "\n", "none": ""}
_RADIX_AUTO_SEPARATORS = re.compile(r"[\t\n\v\f\r ,:;]+")
MAX_BYTE = 0xFF


def _radix_spec(name: str, base: int, width: int) -> tuple[str, re.Pattern[str]]:
    digits = "01" if base == 2 else "01234567" if base == 8 else "0123456789"  # noqa: PLR2004
    return name, re.compile(f"[{digits}]{{1,{width}}}")


_RADIXES = {
    2: (*_radix_spec("binary", 2, 8), 8),
    8: (*_radix_spec("octal", 8, 3), 3),
    10: (*_radix_spec("decimal", 10, 3), 0),
}


def _to_radix(data: bytes, base: int, delimiter: str, ctx: OpContext) -> str:
    ctx.check()
    width = _RADIXES[base][2]
    fmt = {2: "b", 8: "o", 10: "d"}[base]
    spec = f"0{width}{fmt}" if width else fmt
    return RADIX_DELIMITERS[delimiter].join(format(b, spec) for b in data)


def _from_radix(text: str, base: int, delimiter: str, ctx: OpContext) -> bytes:
    ctx.check()
    name, token, width = _RADIXES[base]
    if delimiter == "auto":
        tokens = [t for t in _RADIX_AUTO_SEPARATORS.split(text) if t]
    elif text == "":
        return b""
    elif delimiter == "none":
        if len(text) % width:
            raise _decode_error(f"The input length is not a multiple of {width} {name} digits.")
        tokens = [text[i : i + width] for i in range(0, len(text), width)]
    else:
        tokens = text.split(RADIX_DELIMITERS[delimiter])
    out = bytearray()
    for t in tokens:
        if not token.fullmatch(t) or int(t, base) > MAX_BYTE:
            raise _decode_error(f"{t!r} is not a {name} byte value (0-255).")
        out.append(int(t, base))
    return bytes(out)


_FIXED = tuple(RADIX_DELIMITERS)
_VARIABLE = tuple(d for d in RADIX_DELIMITERS if d != "none")


@operation(
    "to-binary",
    "To Binary",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("delimiter", _FIXED),),
)
def to_binary(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write each byte as eight binary digits, separated by `delimiter`."""
    return _to_radix(data, 2, args.text("delimiter"), ctx)


@operation(
    "from-binary",
    "From Binary",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("delimiter", ("auto", *_FIXED)),),
)
def from_binary(text: str, args: Args, ctx: OpContext) -> bytes:
    """Read bytes of 1-8 binary digits. `auto` splits on runs of whitespace and ,:;
    and `none` reads groups of exactly eight digits."""
    return _from_radix(text, 2, args.text("delimiter"), ctx)


@operation(
    "to-octal",
    "To Octal",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("delimiter", _FIXED),),
)
def to_octal(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write each byte as three octal digits, separated by `delimiter`."""
    return _to_radix(data, 8, args.text("delimiter"), ctx)


@operation(
    "from-octal",
    "From Octal",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("delimiter", ("auto", *_FIXED)),),
)
def from_octal(text: str, args: Args, ctx: OpContext) -> bytes:
    """Read bytes of 1-3 octal digits (at most 377). `auto` splits on runs of whitespace
    and ,:; and `none` reads groups of exactly three digits."""
    return _from_radix(text, 8, args.text("delimiter"), ctx)


@operation(
    "to-decimal",
    "To Decimal",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("delimiter", _VARIABLE),),
)
def to_decimal(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write each byte as a decimal number without padding, separated by `delimiter`."""
    return _to_radix(data, 10, args.text("delimiter"), ctx)


@operation(
    "from-decimal",
    "From Decimal",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("delimiter", ("auto", *_VARIABLE)),),
)
def from_decimal(text: str, args: Args, ctx: OpContext) -> bytes:
    """Read bytes of 1-3 decimal digits (at most 255). `auto` splits on runs of
    whitespace and ,:;"""
    return _from_radix(text, 10, args.text("delimiter"), ctx)


# ---------------------------------------------------------------------------
# URL encoding

_UNRESERVED = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
_RESERVED = frozenset(":/?#[]@!$&'()*+,;=%")
_PERCENT = re.compile(rb"%([0-9A-Fa-f]{2})")


@operation(
    "url-encode",
    "URL Encode",
    "Encoding",
    "string",
    "string",
    (enum_arg("mode", ("component", "all", "reserved-only")),),
)
def url_encode(text: str, args: Args, ctx: OpContext) -> str:
    """Percent-encode with upper-case hex over the UTF-8 bytes of the input."""
    ctx.check()
    mode = args.text("mode")
    if mode == "reserved-only":
        return "".join(f"%{ord(ch):02X}" if ch in _RESERVED else ch for ch in utf8.scrub(text))
    keep = _UNRESERVED if mode == "component" else frozenset()
    return "".join(chr(b) if b in keep else f"%{b:02X}" for b in utf8.encode(text))


@operation(
    "url-decode",
    "URL Decode",
    "Encoding",
    "string",
    "string",
    (bool_arg("plus-as-space"),),
)
def url_decode(text: str, args: Args, ctx: OpContext) -> str:
    """Decode %XX escapes; malformed escapes stay as they are. Never fails."""
    ctx.check()
    raw = utf8.encode(text)
    if args.flag("plus-as-space"):
        raw = raw.replace(b"+", b" ")
    return utf8.decode(_PERCENT.sub(lambda m: bytes.fromhex(m.group(1).decode()), raw))


# ---------------------------------------------------------------------------
# Character encodings

TEXT_ENCODINGS = (
    "utf-8",
    "utf-16le",
    "utf-16be",
    "utf-32le",
    "utf-32be",
    "iso-8859-1",
    "windows-1252",
    "ascii",
)

# WHATWG index-windows-1252 for 0x80-0x9F. The rest of the bytes map to themselves.
_W1252_HIGH = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ"  # noqa: RUF001  # the WHATWG table itself
W1252_DECODE = tuple(_W1252_HIGH[b - 0x80] if b in _W1252_RANGE else chr(b) for b in range(256))
W1252_ENCODE = {ch: b for b, ch in enumerate(W1252_DECODE)}
LATIN1_ENCODE = {chr(b): b for b in range(256)}
ASCII_ENCODE = {chr(b): b for b in range(128)}

TEXT_ARGS = (enum_arg("encoding", TEXT_ENCODINGS), enum_arg("errors", ("replace", "strict")))


def _byteorder(order: str) -> Literal["little", "big"]:
    return "little" if order == "le" else "big"


def _encode_utf16(text: str, order: str) -> bytes:
    out = bytearray()
    for ch in text:
        cp = ord(ch)
        units = (
            (cp,)
            if cp < _SUPPLEMENTARY
            else (0xD800 | ((cp - _SUPPLEMENTARY) >> 10), 0xDC00 | ((cp - _SUPPLEMENTARY) & 0x3FF))
        )
        for unit in units:
            out += unit.to_bytes(2, _byteorder(order))
    return bytes(out)


def _decode_utf16(data: bytes, order: str, strict: bool) -> str:
    byteorder = _byteorder(order)
    units = [int.from_bytes(data[i : i + 2], byteorder) for i in range(0, len(data) - 1, 2)]
    out: list[str] = []
    bad = False
    i = 0
    while i < len(units):
        unit = units[i]
        if (
            unit in utf8.HIGH_SURROGATES
            and i + 1 < len(units)
            and units[i + 1] in utf8.LOW_SURROGATES
        ):
            out.append(chr(_SUPPLEMENTARY + ((unit - 0xD800) << 10) + (units[i + 1] - 0xDC00)))
            i += 2
            continue
        if unit in utf8.SURROGATES:
            out.append(utf8.REPLACEMENT)
            bad = True
        else:
            out.append(chr(unit))
        i += 1
    if len(data) % 2:
        out.append(utf8.REPLACEMENT)
        bad = True
    if bad and strict:
        raise _decode_error("The input is not well-formed UTF-16.")
    return "".join(out)


def _decode_utf32(data: bytes, order: str, strict: bool) -> str:
    byteorder = _byteorder(order)
    out: list[str] = []
    bad = False
    for i in range(0, len(data) - 3, 4):
        cp = int.from_bytes(data[i : i + 4], byteorder)
        if cp > MAX_CODE_POINT or cp in utf8.SURROGATES:
            out.append(utf8.REPLACEMENT)
            bad = True
        else:
            out.append(chr(cp))
    if len(data) % 4:
        out.append(utf8.REPLACEMENT)
        bad = True
    if bad and strict:
        raise _decode_error("The input is not well-formed UTF-32.")
    return "".join(out)


@operation("encode-text", "Encode Text", "Encoding", "string", "bytes", TEXT_ARGS)
def encode_text(text: str, args: Args, ctx: OpContext) -> bytes:
    """Encode text in a character encoding. Lone surrogates become U+FFFD; no BOM."""
    ctx.check()
    encoding = args.text("encoding")
    strict = args.text("errors") == "strict"
    text = utf8.scrub(text)
    if encoding == "utf-8":
        return utf8.encode(text)
    if encoding.startswith("utf-16"):
        return _encode_utf16(text, encoding[-2:])
    if encoding.startswith("utf-32"):
        byteorder = _byteorder(encoding[-2:])
        return b"".join(ord(ch).to_bytes(4, byteorder) for ch in text)
    table = {
        "iso-8859-1": LATIN1_ENCODE,
        "windows-1252": W1252_ENCODE,
        "ascii": ASCII_ENCODE,
    }[encoding]
    out = bytearray()
    for ch in text:
        byte = table.get(ch)
        if byte is None:
            if strict:
                raise _decode_error(f"U+{ord(ch):04X} cannot be encoded in {encoding}.")
            byte = 0x3F
        out.append(byte)
    return bytes(out)


@operation("decode-text", "Decode Text", "Encoding", "bytes", "string", TEXT_ARGS)
def decode_text(data: bytes, args: Args, ctx: OpContext) -> str:
    """Decode bytes from a character encoding. Ill-formed input becomes U+FFFD."""
    encoding = args.text("encoding")
    strict = args.text("errors") == "strict"
    if encoding == "utf-8":
        text = utf8.decode(data, ctx.check)
        if strict and utf8.REPLACEMENT in text and utf8.encode(text) != data:
            raise _decode_error("The input is not well-formed UTF-8.")
        return text
    ctx.check()
    if encoding.startswith("utf-16"):
        return _decode_utf16(data, encoding[-2:], strict)
    if encoding.startswith("utf-32"):
        return _decode_utf32(data, encoding[-2:], strict)
    if encoding == "iso-8859-1":
        return data.decode("latin-1")
    if encoding == "windows-1252":
        return "".join(W1252_DECODE[b] for b in data)
    if strict and any(b > 0x7F for b in data):  # noqa: PLR2004
        raise _decode_error("The input holds a byte above 7F.")
    return "".join(chr(b) if b < _ASCII_END else utf8.REPLACEMENT for b in data)
