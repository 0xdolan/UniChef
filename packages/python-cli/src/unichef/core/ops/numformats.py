# SPDX-License-Identifier: GPL-3.0-or-later
"""Number and key formats: IEEE 754 floats, Bech32, BCD, text as an integer and PEM
(PRD §3.8, 1.1).

Behaviour follows CyberChef v11.5.0 (Apache-2.0), with the deviations listed in
spec/README.md: input is validated strictly rather than read as far as it makes sense.
"""

import base64
import json
import math
import re
import struct

from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    Example,
    OpContext,
    bool_arg,
    enum_arg,
    int_arg,
    operation,
    string_arg,
)

CHECK_EVERY = 4096
_ASCII_SPACE = " \t\n\v\f\r"
_NO_ASCII_SPACE = str.maketrans("", "", _ASCII_SPACE)
_INTEGER = re.compile(r"[+-]?[0-9]+")
_HEX = re.compile(r"[0-9A-Fa-f]*")


def _decode_error(message: str) -> UniChefError:
    return UniChefError("E_DECODE", message)


# ---------------------------------------------------------------------------
# IEEE 754 floats

_DELIMITERS = {
    "space": " ",
    "comma": ",",
    "semicolon": ";",
    "colon": ":",
    "newline": "\n",
    "crlf": "\r\n",
}
_FLOAT_ARGS = (
    enum_arg("endianness", ("big", "little")),
    enum_arg("size", ("float", "double")),
    enum_arg("delimiter", tuple(_DELIMITERS)),
)
_FLOAT = re.compile(r"[+-]?(?:(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|Infinity)|NaN")
_NAN = {"f": bytes.fromhex("7fc00000"), "d": bytes.fromhex("7ff8000000000000")}
# ECMAScript Number::toString switches to exponent form outside 1e-7 < x < 1e21.
_JS_FIXED_MAX, _JS_FIXED_MIN = 21, -6


def _js_number(x: float) -> str:  # noqa: PLR0911  # the cases of Number::toString
    """Format like ECMAScript Number::toString, but keep the sign of a negative zero."""
    if math.isnan(x):
        return "NaN"
    sign = "-" if math.copysign(1.0, x) < 0 else ""
    if math.isinf(x):
        return sign + "Infinity"
    if x == 0:
        return sign + "0"
    mantissa, _, exponent = repr(abs(x)).partition("e")
    whole, _, fraction = mantissa.partition(".")
    padded = whole + fraction
    digits = padded.lstrip("0")
    n = len(whole) + int(exponent or 0) - (len(padded) - len(digits))  # 0.digits x 10^n
    digits = digits.rstrip("0")
    k = len(digits)
    if k <= n <= _JS_FIXED_MAX:
        return sign + digits + "0" * (n - k)
    if 0 < n <= _JS_FIXED_MAX:
        return f"{sign}{digits[:n]}.{digits[n:]}"
    if _JS_FIXED_MIN < n <= 0:
        return f"{sign}0.{'0' * -n}{digits}"
    e = n - 1
    point = "." + digits[1:] if k > 1 else ""
    return f"{sign}{digits[0]}{point}e{'+' if e > 0 else '-'}{abs(e)}"


def _float_format(args: Args) -> tuple[str, str]:
    code = "f" if args.text("size") == "float" else "d"
    return (">" if args.text("endianness") == "big" else "<"), code


@operation(
    "to-float",
    "To Float",
    "Encoding",
    "bytes",
    "string",
    _FLOAT_ARGS,
    examples=(Example("ABCD", {}, "12.141422271728516"),),
)
def to_float(data: bytes, args: Args, ctx: OpContext) -> str:
    """Read the bytes as IEEE 754 numbers, 4 bytes each for `float` or 8 for `double`, and
    write them in decimal joined by `delimiter`. Each number is written with the fewest
    digits that give the same value back."""
    order, code = _float_format(args)
    size = struct.calcsize(code)
    if len(data) % size:
        raise _decode_error(f"The input length is not a multiple of {size} bytes.")
    out = []
    for i, (value,) in enumerate(struct.iter_unpack(order + code, data)):
        if i % CHECK_EVERY == 0:
            ctx.check()
        out.append(_js_number(value))
    return _DELIMITERS[args.text("delimiter")].join(out)


@operation(
    "from-float",
    "From Float",
    "Encoding",
    "string",
    "bytes",
    _FLOAT_ARGS,
    examples=(Example("12.141422271728516", {}, "ABCD"),),
)
def from_float(text: str, args: Args, ctx: OpContext) -> bytes:
    """Read decimal numbers separated by `delimiter` and write each as an IEEE 754 `float`
    (4 bytes) or `double` (8 bytes), rounded to the nearest value. `Infinity`, `-Infinity`
    and `NaN` are accepted."""
    if not text:
        return b""
    order, code = _float_format(args)
    nan = _NAN[code] if order == ">" else _NAN[code][::-1]
    out = bytearray()
    for i, piece in enumerate(text.split(_DELIMITERS[args.text("delimiter")])):
        if i % CHECK_EVERY == 0:
            ctx.check()
        token = piece.strip(_ASCII_SPACE)
        if not _FLOAT.fullmatch(token):
            raise _decode_error(f"{token!r} is not a number.")
        value = float(token)
        if math.isnan(value):
            out += nan
            continue
        try:
            out += struct.pack(order + code, value)
        except OverflowError:  # too large for a float: round to infinity, as IEEE 754 does
            out += struct.pack(order + code, math.copysign(math.inf, value))
    return bytes(out)


# ---------------------------------------------------------------------------
# Bech32 (BIP-173) and Bech32m (BIP-350)

_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_GENERATOR = (0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3)
_CHECKSUM = {"bech32": 1, "bech32m": 0x2BC830A3}
_ENCODING_NAME = {"bech32": "Bech32", "bech32m": "Bech32m"}
_SEGWIT_HRPS = ("bc", "tb", "ltc", "tltc", "bcrt")
_BECH32_MAX, _CHECKSUM_LEN = 90, 6
_HRP_FIRST, _HRP_LAST = 33, 126
_WITNESS_MAX_VERSION = 16
_PROGRAM_MIN, _PROGRAM_MAX, _PROGRAM_V0 = 2, 40, (20, 32)


def _polymod(values: list[int]) -> int:
    chk = 1
    for v in values:
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ v
        for i, g in enumerate(_GENERATOR):
            if (top >> i) & 1:
                chk ^= g
    return chk


def _hrp_expand(hrp: str) -> list[int]:
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _to_words(data: bytes) -> list[int]:
    value = bits = 0
    out = []
    for b in data:
        value = ((value << 8) | b) & 0xFFF
        bits += 8
        while bits >= 5:  # noqa: PLR2004
            bits -= 5
            out.append((value >> bits) & 31)
    if bits:
        out.append((value << (5 - bits)) & 31)
    return out


def _from_words(words: list[int]) -> bytes:
    value = bits = 0
    out = bytearray()
    for w in words:
        value = ((value << 5) | w) & 0xFFF
        bits += 5
        if bits >= 8:  # noqa: PLR2004
            bits -= 8
            out.append((value >> bits) & 255)
    if bits >= 5:  # noqa: PLR2004
        raise _decode_error("The data has a whole unused character at the end.")
    if (value << (8 - bits)) & 255:
        raise _decode_error("The padding bits are not zero.")
    return bytes(out)


def _valid_program(version: int, length: int) -> bool:
    if version == 0:
        return length in _PROGRAM_V0
    return _PROGRAM_MIN <= length <= _PROGRAM_MAX


@operation(
    "to-bech32",
    "To Bech32",
    "Encoding",
    "bytes",
    "string",
    (
        string_arg("hrp", "bc"),
        enum_arg("encoding", tuple(_CHECKSUM)),
        enum_arg("mode", ("generic", "segwit")),
        int_arg("witness_version", 0, 0, _WITNESS_MAX_VERSION),
    ),
    examples=(Example("Hi", {"hrp": "test"}, "test1fp5sjj6w55"),),
)
def to_bech32(data: bytes, args: Args, ctx: OpContext) -> str:
    """Encode bytes as Bech32 or Bech32m: the human-readable part `hrp`, a `1`, the data in
    a 32-character alphabet and a six-character checksum. `segwit` mode writes a Bitcoin
    SegWit address from a witness program and `witness_version`."""
    ctx.check()
    hrp = args.text("hrp")
    if not hrp or any(not _HRP_FIRST <= ord(c) <= _HRP_LAST for c in hrp):
        raise UniChefError("E_ARG_INVALID", "hrp must be one or more printable ASCII characters.")
    hrp = hrp.lower()
    too_long = _decode_error(f"The result is longer than {_BECH32_MAX} characters.")
    if len(data) > _BECH32_MAX:
        raise too_long
    if args.text("mode") == "segwit":
        version = args.integer("witness_version")
        if not _PROGRAM_MIN <= len(data) <= _PROGRAM_MAX:
            raise _decode_error("A witness program is 2 to 40 bytes long.")
        if not _valid_program(version, len(data)):
            raise _decode_error("A version 0 witness program is 20 or 32 bytes long.")
        words = [version, *_to_words(data)]
    else:
        words = _to_words(data)
    constant = _CHECKSUM[args.text("encoding")]
    mod = _polymod(_hrp_expand(hrp) + words + [0] * _CHECKSUM_LEN) ^ constant
    words += [(mod >> (5 * (5 - i))) & 31 for i in range(_CHECKSUM_LEN)]
    result = hrp + "1" + "".join(_CHARSET[w] for w in words)
    if len(result) > _BECH32_MAX:
        raise too_long
    return result


def _bech32_split(text: str) -> tuple[str, list[int]]:
    if len(text) > _BECH32_MAX:
        raise _decode_error(f"A Bech32 string is at most {_BECH32_MAX} characters long.")
    if not text.isascii():
        raise _decode_error("A Bech32 string is ASCII only.")
    if text != text.lower() and text != text.upper():
        raise _decode_error("A Bech32 string is all lower case or all upper case.")
    text = text.lower()
    sep = text.rfind("1")
    if sep < 1:
        raise _decode_error("There is no human-readable part before a '1'.")
    if sep + 1 + _CHECKSUM_LEN > len(text):
        raise _decode_error("The data part is shorter than the six-character checksum.")
    hrp = text[:sep]
    if any(not _HRP_FIRST <= ord(c) <= _HRP_LAST for c in hrp):
        raise _decode_error("The human-readable part has a character that is not printable ASCII.")
    data = [_CHARSET.find(c) for c in text[sep + 1 :]]
    if min(data) < 0:
        raise _decode_error("The data part has a character outside the Bech32 alphabet.")
    return hrp, data


@operation(
    "from-bech32",
    "From Bech32",
    "Encoding",
    "string",
    "string",
    (
        enum_arg("encoding", ("auto", *_CHECKSUM)),
        enum_arg("format", ("hex", "raw", "script-pubkey", "hrp-hex", "json")),
    ),
    examples=(Example("test1fp5sjj6w55", {}, "4869"),),
)
def from_bech32(text: str, args: Args, ctx: OpContext) -> str:
    """Check the checksum of a Bech32 or Bech32m string and write its data as hex. A SegWit
    address gives the witness version byte and then the program. Other formats: `raw` (one
    character per byte), `script-pubkey`, `hrp-hex` and `json`."""
    ctx.check()
    text = text.strip(_ASCII_SPACE)
    if not text:
        return ""
    hrp, data = _bech32_split(text)
    wanted = args.text("encoding")
    mod = _polymod(_hrp_expand(hrp) + data)
    encoding = next(
        (name for name, c in _CHECKSUM.items() if c == mod and wanted in ("auto", name)), None
    )
    if encoding is None:
        raise _decode_error("The checksum is wrong.")
    words = data[:-_CHECKSUM_LEN]
    version = None
    payload = None
    if hrp in _SEGWIT_HRPS and words and words[0] <= _WITNESS_MAX_VERSION:
        try:
            program = _from_words(words[1:])
        except UniChefError:
            program = None
        if program is not None and _valid_program(words[0], len(program)):
            version = words[0]
            payload = bytes([version]) + program
    if payload is None:
        payload = _from_words(words)
    fmt = args.text("format")
    if fmt == "raw":
        return payload.decode("latin-1")
    if fmt == "script-pubkey" and version is not None:
        opcode = 0x50 + version if version else 0
        return bytes([opcode, len(payload) - 1, *payload[1:]]).hex()
    if fmt == "hrp-hex":
        return f"{hrp}: {payload.hex()}"
    if fmt == "json":
        doc = {"hrp": hrp, "encoding": _ENCODING_NAME[encoding], "data": payload.hex()}
        return json.dumps(doc, indent=2, ensure_ascii=False)
    return payload.hex()


# ---------------------------------------------------------------------------
# Binary-coded decimal

_BCD = {
    "8421": (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    "7421": (0, 1, 2, 3, 4, 5, 6, 8, 9, 10),
    "4221": (0, 1, 4, 5, 8, 9, 12, 13, 14, 15),
    "2421": (0, 1, 2, 3, 4, 11, 12, 13, 14, 15),
    "84-2-1": (0, 7, 6, 5, 4, 11, 10, 9, 8, 15),
    "excess-3": (3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
    "ibm-8421": (10, 1, 2, 3, 4, 5, 6, 7, 8, 9),
}
_BCD_ARGS = (
    enum_arg("scheme", tuple(_BCD)),
    bool_arg("packed", default=True),
    bool_arg("signed"),
    enum_arg("format", ("nibbles", "bytes", "raw")),
)
_PLUS, _MINUS, _MINUS_ALT = 12, 13, 11
_LATIN1_MAX = 0xFF


@operation(
    "to-bcd",
    "To BCD",
    "Encoding",
    "string",
    "string",
    _BCD_ARGS,
    examples=(Example("1234", {}, "0001 0010 0011 0100"),),
)
def to_bcd(text: str, args: Args, ctx: OpContext) -> str:
    """Write a decimal integer as binary-coded decimal: four bits per digit in the chosen
    `scheme`. `packed` puts two digits in a byte, `signed` adds a sign nibble (1100 plus,
    1101 minus) at the end, and `format` shows nibbles, bytes or one character per byte."""
    ctx.check()
    token = text.strip(_ASCII_SPACE)
    if not token:
        return ""
    if not _INTEGER.fullmatch(token):
        raise _decode_error("The input is not a decimal integer.")
    digits = token.lstrip("+-").lstrip("0") or "0"
    negative = token[0] == "-" and digits != "0"
    table = _BCD[args.text("scheme")]
    packed = args.flag("packed")
    nibbles = [table[ord(d) - 0x30] for d in digits]
    if args.flag("signed"):
        if packed and len(digits) % 2 == 0:
            nibbles.insert(0, table[0])
        nibbles.append(_MINUS if negative else _PLUS)
    if packed:
        padded = [*nibbles, 0] if len(nibbles) % 2 else nibbles
        data = [(padded[i] << 4) | padded[i + 1] for i in range(0, len(padded), 2)]
    else:
        data = nibbles
        nibbles = [n for low in nibbles for n in (0, low)]
    fmt = args.text("format")
    if fmt == "nibbles":
        return " ".join(f"{n:04b}" for n in nibbles)
    if fmt == "bytes":
        return " ".join(f"{b:08b}" for b in data)
    return bytes(data).decode("latin-1")


@operation(
    "from-bcd",
    "From BCD",
    "Encoding",
    "string",
    "string",
    _BCD_ARGS,
    examples=(Example("0001 0010 0011 0100", {}, "1234"),),
)
def from_bcd(text: str, args: Args, ctx: OpContext) -> str:
    """Read binary-coded decimal back into a decimal integer. The input is binary digits
    (`nibbles` or `bytes`, spaces ignored) or one character per byte (`raw`). With `signed`,
    the last nibble is the sign: 1101 or 1011 is minus."""
    ctx.check()
    if args.text("format") == "raw":
        if any(ord(c) > _LATIN1_MAX for c in text):
            raise _decode_error("Raw input can only hold characters up to U+00FF.")
        nibbles = [n for c in text for n in (ord(c) >> 4, ord(c) & 15)]
    else:
        bits = text.translate(_NO_ASCII_SPACE)
        if len(bits) % 4 or bits.strip("01"):
            raise _decode_error("The input is not groups of four binary digits.")
        nibbles = [int(bits[i : i + 4], 2) for i in range(0, len(bits), 4)]
    if not nibbles:
        return ""
    if not args.flag("packed"):
        nibbles = nibbles[1::2]
    sign = ""
    if args.flag("signed") and nibbles and nibbles.pop() in (_MINUS, _MINUS_ALT):
        sign = "-"
    if not nibbles:
        raise _decode_error("The input has no digits.")
    table = _BCD[args.text("scheme")]
    for n in nibbles:
        if n not in table:
            raise _decode_error(f"{n:04b} is not a digit in this scheme.")
    digits = "".join(str(table.index(n)) for n in nibbles).lstrip("0")
    return sign + digits if digits else "0"


# ---------------------------------------------------------------------------
# Text as an integer

# What JavaScript's String.prototype.trim removes.
_JS_TRIM = "".join(
    map(chr, (9, 10, 11, 12, 13, 0x20, 0xA0, 0x1680, *range(0x2000, 0x200B), 0x2028, 0x2029))
) + "".join(map(chr, (0x202F, 0x205F, 0x3000, 0xFEFF)))
_LINE_TERMINATORS = frozenset(map(chr, (0x0A, 0x0D, 0x2028, 0x2029)))
_HEX_INTEGER = re.compile(r"0[xX][0-9A-Fa-f]+")
_QUOTES = "\"'"
MAX_INTEGER_BYTES = 1024
_MAX_DECIMAL_DIGITS = 2467  # 256 ** 1024 has 2467 digits


def _text_integer(token: str) -> int:
    too_large = _decode_error(f"The number is larger than {MAX_INTEGER_BYTES} bytes.")
    if not token:
        return 0
    if _HEX_INTEGER.fullmatch(token):
        digits = token[2:].lstrip("0")
        if len(digits) > MAX_INTEGER_BYTES * 2:
            raise too_large
        return int(digits or "0", 16)
    if _INTEGER.fullmatch(token):
        digits = token.lstrip("+-").lstrip("0")
        if len(digits) > _MAX_DECIMAL_DIGITS:
            raise too_large
        value = int(digits or "0")
        if value.bit_length() > MAX_INTEGER_BYTES * 8:
            raise too_large
        return -value if token[0] == "-" else value
    quoted = len(token) > 1 and token[0] in _QUOTES and token[-1] in _QUOTES
    if quoted and _LINE_TERMINATORS.isdisjoint(token):
        token = token[1:-1]
    if len(token) > MAX_INTEGER_BYTES:
        raise too_large
    if any(ord(c) > _LATIN1_MAX for c in token):
        raise _decode_error("Text can only hold characters up to U+00FF.")
    return int.from_bytes(token.encode("latin-1"), "big")


@operation(
    "text-integer",
    "Text-Integer Conversion",
    "Encoding",
    "string",
    "string",
    (enum_arg("output", ("string", "decimal", "hex")),),
    examples=(Example("ABC", {"output": "decimal"}, "4276803"),),
)
def text_integer(text: str, args: Args, ctx: OpContext) -> str:
    """Convert between text and the big-endian integer its bytes spell: `ABC` is 0x414243 is
    4276803. Input that is all digits is read as decimal, input starting with 0x as hex and
    anything else, quoted or not, as text. `output` picks the form to write."""
    ctx.check()
    value = _text_integer(text.strip(_JS_TRIM))
    output = args.text("output")
    if output == "decimal":
        return str(value)
    if output == "hex":
        return f"{'-' if value < 0 else ''}0x{abs(value):x}"
    if value < 0:
        raise _decode_error("A negative number has no text form.")
    return value.to_bytes((value.bit_length() + 7) // 8, "big").decode("latin-1")


# ---------------------------------------------------------------------------
# PEM

_PEM_BEGIN = re.compile(r"-----BEGIN ([A-Z][A-Z ]+[A-Z])-----")
_NOT_BASE64 = re.compile(r"[^A-Za-z0-9+/]+")
_PEM_LINE = 64


@operation(
    "pem-to-hex",
    "PEM to Hex",
    "Encoding",
    "string",
    "string",
    (),
    examples=(Example("-----BEGIN DATA-----\nSGk=\n-----END DATA-----", {}, "4869"),),
)
def pem_to_hex(text: str, _args: Args, ctx: OpContext) -> str:
    """Find each PEM block (BEGIN and END lines with the same label), decode its Base64 body
    and write the bytes as hex, one line per block."""
    out = []
    for m in _PEM_BEGIN.finditer(text):
        ctx.check()
        footer = f"-----END {m[1]}-----"
        end = text.find(footer, m.end())
        if end < 0:
            raise _decode_error(f"{footer} was not found.")
        body = _NOT_BASE64.sub("", text[m.end() : end])
        if len(body) % 4 == 1:
            raise _decode_error("A Base64 body has one character too many.")
        out.append(base64.b64decode(body + "=" * (-len(body) % 4)).hex())
    return "\n".join(out)


@operation(
    "hex-to-pem",
    "Hex to PEM",
    "Encoding",
    "string",
    "string",
    (string_arg("header", "CERTIFICATE"),),
    examples=(
        Example(
            "4869", {"header": "DATA"}, "-----BEGIN DATA-----\r\nSGk=\r\n-----END DATA-----\r\n"
        ),
    ),
)
def hex_to_pem(text: str, args: Args, ctx: OpContext) -> str:
    """Write hex bytes (usually DER) as a PEM block: a BEGIN line with the `header` label,
    the bytes as Base64 in lines of 64 characters, and an END line. Lines end in CR LF."""
    ctx.check()
    digits = text.translate(_NO_ASCII_SPACE)
    if len(digits) % 2 or not _HEX.fullmatch(digits):
        raise _decode_error("The input is not pairs of hex digits.")
    body = base64.b64encode(bytes.fromhex(digits)).decode("ascii")
    lines = "\r\n".join(body[i : i + _PEM_LINE] for i in range(0, len(body), _PEM_LINE))
    header = args.text("header")
    return f"-----BEGIN {header}-----\r\n{lines}\r\n-----END {header}-----\r\n"
