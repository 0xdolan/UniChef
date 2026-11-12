# SPDX-License-Identifier: GPL-3.0-or-later
"""Number bases, character codes, Modhex and byte order (PRD §3.8 1.1; semantics in
spec/README.md)."""

import re

from unichef.core.dish import MAX_CODE_POINT
from unichef.core.errors import UniChefError
from unichef.core.ops.encoding import parse_hex_auto
from unichef.core.registry import (
    Args,
    Example,
    OpContext,
    bool_arg,
    enum_arg,
    int_arg,
    operation,
)

DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"
MIN_RADIX = 2
MAX_RADIX = len(DIGITS)
MAX_BITS = 13_000  # from-base results stay well inside a printable integer dish
CHECK_EVERY = 4096
_ASCII_SPACE = "\t\n\v\f\r "
_SPACE = re.compile(f"[{_ASCII_SPACE}]+")
_ASCII_LOWER = str.maketrans("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")
_HEX = 16
_ONE_BYTE = 0x100
_TWO_BYTES = 0x10000


def _decode_error(what: str) -> UniChefError:
    return UniChefError("E_DECODE", what)


def _digits(value: int, radix: int, ctx: OpContext) -> str:
    """`value` (zero or more) in `radix`, lower-case, without padding."""
    if value == 0:
        return "0"
    out: list[str] = []
    while value:
        if len(out) % CHECK_EVERY == 0:
            ctx.check()
        value, digit = divmod(value, radix)
        out.append(DIGITS[digit])
    return "".join(reversed(out))


def _parse_digits(body: str, radix: int, ctx: OpContext) -> int:
    """`body` (case-insensitive) as a number in `radix`, or E_DECODE naming the bad digit."""
    allowed = DIGITS[:radix]
    value = 0
    for i, ch in enumerate(body.translate(_ASCII_LOWER)):
        if i % CHECK_EVERY == 0:
            ctx.check()
        digit = allowed.find(ch) if len(ch) == 1 else -1
        if digit < 0:
            raise _decode_error(f"{body[i]!r} is not a base-{radix} digit.")
        value = value * radix + digit
    return value


# ---------------------------------------------------------------------------
# Any radix

FRACTION_DIGITS = 20  # fraction digits written, rounded half up (as CyberChef's BigNumber)
MAX_DECIMAL_DIGITS = 4000
_DECIMAL = re.compile(r"([+-]?)([0-9]*)(?:\.([0-9]*))?")


def _round_half_up(numerator: int, denominator: int) -> int:
    quotient, remainder = divmod(numerator, denominator)
    return quotient + (2 * remainder >= denominator)


@operation(
    "to-base",
    "To Base",
    "Encoding",
    "string",
    "string",
    (int_arg("radix", 36, MIN_RADIX, MAX_RADIX),),
    examples=(Example("255", {"radix": 16}, "ff"), Example("10.5", {"radix": 2}, "1010.1")),
)
def to_base(text: str, args: Args, ctx: OpContext) -> str:
    """Write a decimal number in a radix from 2 to 36 with lower-case digits. A fraction
    gets at most 20 digits, rounded half up."""
    radix = args.integer("radix")
    match = _DECIMAL.fullmatch(_SPACE.sub("", text))
    if match is None or not (match.group(2) or match.group(3)):
        raise _decode_error("The input is not a decimal number.")
    sign, whole, fraction = match.group(1), match.group(2), match.group(3) or ""
    if len(whole) + len(fraction) > MAX_DECIMAL_DIGITS:
        raise _decode_error(f"The number has more than {MAX_DECIMAL_DIGITS} digits.")
    scale = 10 ** len(fraction)
    integer, remainder = divmod(int(whole + fraction or "0"), scale)
    fraction_digits = ""
    if remainder:
        steps = radix**FRACTION_DIGITS
        scaled = _round_half_up(remainder * steps, scale)
        if scaled == steps:
            integer, scaled = integer + 1, 0
        if scaled:
            body = _digits(scaled, radix, ctx).rjust(FRACTION_DIGITS, "0")
            fraction_digits = "." + body.rstrip("0")
    out = _digits(integer, radix, ctx) + fraction_digits
    return "-" + out if sign == "-" and out != "0" else out


@operation(
    "from-base",
    "From Base",
    "Encoding",
    "string",
    "string",
    (int_arg("radix", 36, MIN_RADIX, MAX_RADIX),),
    examples=(Example("ff", {"radix": 16}, "255"), Example("10.1", {"radix": 2}, "2.5")),
)
def from_base(text: str, args: Args, ctx: OpContext) -> str:
    """Read a number written in a radix from 2 to 36 and write it in decimal. Digits are
    case-insensitive, whitespace is ignored and a leading + or - is allowed. A fraction
    gets at most 20 decimal places, rounded half up."""
    radix = args.integer("radix")
    body = _SPACE.sub("", text)
    negative = body.startswith("-")
    if body[:1] in {"-", "+"}:
        body = body[1:]
    whole, _, fraction = body.partition(".")
    if not whole and not fraction:
        raise _decode_error("The input holds no digits.")
    too_large = f"The number is larger than {MAX_BITS} bits."
    if len((whole + fraction).lstrip("0")) > MAX_BITS:
        raise _decode_error(too_large)
    numerator = _parse_digits(whole + fraction, radix, ctx)
    scale = radix ** len(fraction)
    if (numerator // scale).bit_length() > MAX_BITS:
        raise _decode_error(too_large)
    scaled = _round_half_up(numerator * 10**FRACTION_DIGITS, scale)
    integer, rest = divmod(scaled, 10**FRACTION_DIGITS)
    out = str(integer)
    if rest:
        out += "." + str(rest).rjust(FRACTION_DIGITS, "0").rstrip("0")
    return "-" + out if negative and out != "0" else out


# ---------------------------------------------------------------------------
# Character codes

CHARCODE_DELIMITERS = {
    "space": " ",
    "comma": ",",
    "semicolon": ";",
    "colon": ":",
    "newline": "\n",
    "crlf": "\r\n",
}
_MAX_CODE_DIGITS = 21  # U+10FFFF in binary


@operation(
    "to-charcode",
    "To Charcode",
    "Encoding",
    "codepoints",
    "string",
    (
        enum_arg("delimiter", tuple(CHARCODE_DELIMITERS)),
        int_arg("base", 16, MIN_RADIX, MAX_RADIX),
    ),
    examples=(Example("Hé 👋", {}, "48 e9 20 01f44b"),),
)
def to_charcode(cps: list[int], args: Args, ctx: OpContext) -> str:
    """Write each code point in `base`. Base 16 pads to 2, 4 or 6 digits; other bases do
    not pad."""
    delimiter = CHARCODE_DELIMITERS[args.text("delimiter")]
    base = args.integer("base")
    out: list[str] = []
    for i, cp in enumerate(cps):
        if i % CHECK_EVERY == 0:
            ctx.check()
        if base == _HEX:
            width = 2 if cp < _ONE_BYTE else 4 if cp < _TWO_BYTES else 6
            out.append(format(cp, f"0{width}x"))
        else:
            out.append(_digits(cp, base, ctx))
    return delimiter.join(out)


@operation(
    "from-charcode",
    "From Charcode",
    "Encoding",
    "string",
    "codepoints",
    (
        enum_arg("delimiter", tuple(CHARCODE_DELIMITERS)),
        int_arg("base", 16, MIN_RADIX, MAX_RADIX),
    ),
    examples=(Example("48 e9 20 1f44b", {}, "U+0048 U+00E9 U+0020 U+1F44B"),),
)
def from_charcode(text: str, args: Args, ctx: OpContext) -> list[int]:
    """Read code points written in `base` and separated by `delimiter`. Whitespace around
    each code is ignored and empty codes are skipped."""
    delimiter = CHARCODE_DELIMITERS[args.text("delimiter")]
    base = args.integer("base")
    out: list[int] = []
    for i, raw in enumerate(text.split(delimiter)):
        if i % CHECK_EVERY == 0:
            ctx.check()
        token = raw.strip(_ASCII_SPACE)
        if not token:
            continue
        if len(token.lstrip("0")) > _MAX_CODE_DIGITS:
            raise _decode_error(f"{token[:16]!r} is above U+10FFFF.")
        value = _parse_digits(token, base, ctx)
        if value > MAX_CODE_POINT:
            raise _decode_error(f"{token[:16]!r} is above U+10FFFF.")
        out.append(value)
    return out


# ---------------------------------------------------------------------------
# Modhex (YubiKey): hex with the digits 0-f written as cbdefghijklnrtuv

MODHEX = "cbdefghijklnrtuv"
MODHEX_DELIMITERS = {
    "space": " ",
    "percent": "%",
    "comma": ",",
    "semicolon": ";",
    "colon": ":",
    "newline": "\n",
    "crlf": "\r\n",
    "none": "",
}
_NOT_MODHEX = re.compile(f"[^{MODHEX}]")


@operation(
    "to-modhex",
    "To Modhex",
    "Encoding",
    "bytes",
    "string",
    (
        enum_arg("delimiter", tuple(MODHEX_DELIMITERS)),
        int_arg("bytes_per_line", 0, 0),
    ),
    examples=(Example("Hi!", {}, "fj hk db"),),
)
def to_modhex(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write each byte as two Modhex digits, separated by `delimiter`. With
    `bytes_per_line`, a line feed follows the delimiter after every that many bytes."""
    delimiter = MODHEX_DELIMITERS[args.text("delimiter")]
    per_line = args.integer("bytes_per_line")
    out: list[str] = []
    last = len(data) - 1
    for i, byte in enumerate(data):
        if i % CHECK_EVERY == 0:
            ctx.check()
        out.append(MODHEX[byte >> 4] + MODHEX[byte & 0xF])
        if i != last:
            out.append(delimiter)
            if per_line and (i + 1) % per_line == 0:
                out.append("\n")
    return "".join(out)


@operation(
    "from-modhex",
    "From Modhex",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("delimiter", ("auto", *MODHEX_DELIMITERS)),),
    examples=(Example("fj hk db", {}, "Hi!"),),
)
def from_modhex(text: str, args: Args, ctx: OpContext) -> bytes:
    """Read Modhex digit pairs, in either case, ignoring whitespace. `auto` also drops
    every other character; any other choice removes only that delimiter."""
    ctx.check()
    delimiter = args.text("delimiter")
    digits = _SPACE.sub("", text.translate(_ASCII_LOWER))
    if delimiter == "auto":
        digits = _NOT_MODHEX.sub("", digits)
    elif MODHEX_DELIMITERS[delimiter]:
        digits = digits.replace(MODHEX_DELIMITERS[delimiter], "")
    bad = _NOT_MODHEX.search(digits)
    if bad is not None:
        raise _decode_error(f"{bad.group()!r} is not a Modhex digit.")
    if len(digits) % 2:
        raise _decode_error("The input has an odd number of Modhex digits.")
    nibbles = [MODHEX.index(ch) for ch in digits]
    return bytes(hi << 4 | lo for hi, lo in zip(nibbles[::2], nibbles[1::2], strict=True))


# ---------------------------------------------------------------------------
# Byte order


@operation(
    "swap-endianness",
    "Swap Endianness",
    "Encoding",
    "bytes",
    "bytes",
    (
        enum_arg("format", ("hex", "raw")),
        int_arg("word_length", 4, 1),
        bool_arg("pad", default=True),
    ),
    examples=(Example("0a0b0c0d 01", {}, "0d 0c 0b 0a 00 00 00 01"),),
)
def swap_endianness(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Reverse the byte order inside each word of `word_length` bytes. With `hex`, the
    input is hex text (as From Hex reads it with `auto`) and the output is space-separated
    lower-case hex. With `pad`, a short final word is filled with zero bytes first."""
    ctx.check()
    hex_text = args.text("format") == "hex"
    raw = parse_hex_auto(data.decode("latin-1")) if hex_text else data
    size = args.integer("word_length")
    pad = args.flag("pad")
    out = bytearray()
    for start in range(0, len(raw), size):
        if start % (CHECK_EVERY * 16) == 0:
            ctx.check()
        word = raw[start : start + size]
        if pad:
            word = word.ljust(size, b"\0")
        out += word[::-1]
    if hex_text:
        return " ".join(f"{b:02x}" for b in out).encode("ascii")
    return bytes(out)
