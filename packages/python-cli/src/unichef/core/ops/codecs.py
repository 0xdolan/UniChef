# SPDX-License-Identifier: GPL-3.0-or-later
"""Base58, Base85 and quoted-printable (PRD §3.8 Beta; semantics in spec/README.md)."""

import re

from unichef.core.errors import UniChefError
from unichef.core.registry import Args, Example, OpContext, bool_arg, enum_arg, operation
from unichef.unicode import utf8


def _decode_error(what: str) -> UniChefError:
    return UniChefError("E_DECODE", what)


# ---------------------------------------------------------------------------
# Base58

B58 = {
    "bitcoin": "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    "flickr": "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
}
# Digits per big-integer step: 58**10 < 2**63, so each step handles ten digits at once.
_B58_STEP = 10
_B58_BASE = 58**_B58_STEP


@operation(
    "to-base58",
    "To Base58",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("alphabet", tuple(B58)),),
    examples=(Example("Hello", {}, "9Ajdvzr"),),
)
def to_base58(data: bytes, args: Args, ctx: OpContext) -> str:
    """Encode bytes as Base58. Each leading zero byte becomes the alphabet's first digit."""
    alphabet = B58[args.text("alphabet")]
    body = data.lstrip(b"\0")
    number = int.from_bytes(body, "big")
    chunks: list[str] = []
    while number:
        ctx.check()
        number, chunk = divmod(number, _B58_BASE)
        digits = []
        for _ in range(_B58_STEP):
            chunk, digit = divmod(chunk, 58)
            digits.append(alphabet[digit])
        chunks.append("".join(reversed(digits)))
    text = "".join(reversed(chunks)).lstrip(alphabet[0])
    return alphabet[0] * (len(data) - len(body)) + text


@operation(
    "from-base58",
    "From Base58",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("alphabet", tuple(B58)), bool_arg("strict")),
    examples=(Example("9Ajdvzr", {}, "Hello"),),
)
def from_base58(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode Base58. Without `strict`, it skips characters outside the alphabet."""
    alphabet = B58[args.text("alphabet")]
    index = {ch: i for i, ch in enumerate(alphabet)}
    if args.flag("strict"):
        bad = next((ch for ch in text if ch not in index), None)
        if bad is not None:
            raise _decode_error(f"Strict mode: {bad!r} is not a Base58 digit.")
        chars = text
    else:
        chars = "".join(ch for ch in text if ch in index)
    body = chars.lstrip(alphabet[0])
    number = 0
    for start in range(0, len(body), _B58_STEP):
        ctx.check()
        part = body[start : start + _B58_STEP]
        chunk = 0
        for ch in part:
            chunk = chunk * 58 + index[ch]
        number = number * 58 ** len(part) + chunk
    return b"\0" * (len(chars) - len(body)) + number.to_bytes((number.bit_length() + 7) // 8)


# ---------------------------------------------------------------------------
# Base85

B85 = {
    "ascii85": "".join(chr(c) for c in range(0x21, 0x76)),
    "z85": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#",
}
_B85_GROUP = 4
_B85_DIGITS = 5
_B85_ZERO = "z"
_U32_MAX = 0xFFFFFFFF
_B85_CHECK_EVERY = 16 * 1024


def _encode_b85(data: bytes, alphabet: str, zero: bool, ctx: OpContext) -> str:
    out: list[str] = []
    for start in range(0, len(data), _B85_GROUP):
        if start % _B85_CHECK_EVERY == 0:
            ctx.check()
        group = data[start : start + _B85_GROUP]
        if zero and group == b"\0\0\0\0":
            out.append(_B85_ZERO)
            continue
        value = int.from_bytes(group.ljust(_B85_GROUP, b"\0"), "big")
        digits = []
        for _ in range(_B85_DIGITS):
            value, digit = divmod(value, 85)
            digits.append(alphabet[digit])
        out.append("".join(reversed(digits))[: len(group) + 1])
    return "".join(out)


@operation(
    "to-base85",
    "To Base85",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("alphabet", tuple(B85)), bool_arg("delimiters")),
    examples=(Example("Hello", {}, "87cURDZ"),),
)
def to_base85(data: bytes, args: Args, ctx: OpContext) -> str:
    """Encode bytes as Ascii85 (`z` for a group of four zero bytes) or Z85."""
    name = args.text("alphabet")
    if args.flag("delimiters") and name != "ascii85":
        raise UniChefError("E_ARG_INVALID", "Only Ascii85 has <~ ~> delimiters.")
    text = _encode_b85(data, B85[name], name == "ascii85", ctx)
    return f"<~{text}~>" if args.flag("delimiters") else text


@operation(
    "from-base85",
    "From Base85",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("alphabet", tuple(B85)), bool_arg("strict")),
    examples=(Example("87cURDZ", {}, "Hello"),),
)
def from_base85(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode Ascii85 (optionally inside `<~ ~>`) or Z85. Without `strict`, it skips
    characters outside the alphabet."""
    name = args.text("alphabet")
    alphabet = B85[name]
    zero = name == "ascii85"
    strict = args.flag("strict")
    body = text if strict else text.strip()
    if zero and len(body) >= 4 and body.startswith("<~") and body.endswith("~>"):  # noqa: PLR2004
        body = body[2:-2]
    index = {ch: i for i, ch in enumerate(alphabet)}
    usable = set(index) | ({_B85_ZERO} if zero else set())
    if strict:
        bad = next((ch for ch in body if ch not in usable), None)
        if bad is not None:
            raise _decode_error(f"Strict mode: {bad!r} is not a Base85 digit.")
    else:
        body = "".join(ch for ch in body if ch in usable)
    out = bytearray()
    pos = groups = 0
    while pos < len(body):
        groups += 1
        if groups % _B85_CHECK_EVERY == 0:
            ctx.check()
        if zero and body[pos] == _B85_ZERO:
            out += b"\0\0\0\0"
            pos += 1
            continue
        group = body[pos : pos + _B85_DIGITS]
        if zero and _B85_ZERO in group:
            raise _decode_error(f"'z' at offset {pos + group.index(_B85_ZERO)} is inside a group.")
        if len(group) == 1:
            raise _decode_error("The input ends with an incomplete Base85 group.")
        value = 0
        for ch in group.ljust(_B85_DIGITS, alphabet[-1]):
            value = value * 85 + index[ch]
        if value > _U32_MAX:
            raise _decode_error(f"The Base85 group at offset {pos} is out of range.")
        out += value.to_bytes(_B85_GROUP, "big")[: len(group) - 1]
        pos += _B85_DIGITS
    if strict and _encode_b85(bytes(out), alphabet, zero, ctx) != body:
        raise _decode_error("Strict mode: the input is not canonical.")
    return bytes(out)


# ---------------------------------------------------------------------------
# Quoted-printable (RFC 2045 §6.7)

QP_MODES = ("text", "binary")
_QP_LINE = 76
_QP_CHECK_EVERY = 1024
_QP_LITERAL = frozenset(range(33, 127)) - {ord("=")}
_QP_SPACE = frozenset(b" \t")
_QP_BREAK = re.compile(rb"\r\n|\n")
_QP_LINE_BREAK = re.compile(r"(\r\n|\n)")
_QP_ESCAPE = re.compile(r"=([0-9A-Fa-f]{2})")
_QP_STRICT_ESCAPE = re.compile(r"=[0-9A-F]{2}")
_QP_STRICT_TEXT = re.compile(r"[\t\x20-\x7e]*")


def _qp_tokens(line: bytes) -> list[str]:
    tokens = [chr(b) if b in _QP_LITERAL or b in _QP_SPACE else f"={b:02X}" for b in line]
    if line and line[-1] in _QP_SPACE:
        tokens[-1] = f"={line[-1]:02X}"
    return tokens


def _qp_wrap(tokens: list[str]) -> list[str]:
    lines: list[str] = []
    current: list[str] = []
    width = 0
    for i, token in enumerate(tokens):
        last = i == len(tokens) - 1
        # A soft break needs one column for its "=", except after the line's last token.
        room = _QP_LINE if last else _QP_LINE - 1
        if width + len(token) > room:
            lines.append("".join(current) + "=")
            current, width = [], 0
        current.append(token)
        width += len(token)
    lines.append("".join(current))
    return lines


@operation(
    "quoted-printable-encode",
    "Quoted-Printable Encode",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("mode", QP_MODES),),
    examples=(Example("café = 4€", {}, "caf=C3=A9 =3D 4=E2=82=AC"),),
)
def quoted_printable_encode(data: bytes, args: Args, ctx: OpContext) -> str:
    """Encode bytes as quoted-printable, with lines of at most 76 characters. In `text`
    mode, LF and CRLF are line breaks, written as CRLF; in `binary` mode they are escaped."""
    ctx.check()
    lines = _QP_BREAK.split(data) if args.text("mode") == "text" else [data]
    out: list[str] = []
    for number, line in enumerate(lines):
        if number % _QP_CHECK_EVERY == 0:
            ctx.check()
        out.extend(_qp_wrap(_qp_tokens(line)))
    return "\r\n".join(out)


@operation(
    "quoted-printable-decode",
    "Quoted-Printable Decode",
    "Encoding",
    "string",
    "bytes",
    (bool_arg("strict"),),
    examples=(Example("caf=C3=A9 =3D 4=E2=82=AC", {}, "café = 4€"),),
)
def quoted_printable_decode(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode quoted-printable. Soft line breaks and trailing spaces are removed, and
    other line breaks are kept as they are. Without `strict`, lower-case hex is accepted
    and a stray `=` is kept."""
    strict = args.flag("strict")
    parts = _QP_LINE_BREAK.split(text)
    out = bytearray()
    for i in range(0, len(parts), 2):
        if i % (2 * _QP_CHECK_EVERY) == 0:
            ctx.check()
        line = parts[i].rstrip(" \t")
        brk = parts[i + 1] if i + 1 < len(parts) else ""
        soft = line.endswith("=")
        if soft:
            line = line[:-1]
        if strict:
            _qp_strict_check(line, i // 2 + 1)
        out += _qp_line(line)
        if not soft:
            out += brk.encode("ascii")
    return bytes(out)


def _qp_strict_check(line: str, number: int) -> None:
    if not _QP_STRICT_TEXT.fullmatch(line):
        raise _decode_error(f"Strict mode: line {number} has a character outside printable ASCII.")
    stray = _QP_STRICT_ESCAPE.sub("", line)
    if "=" in stray:
        raise _decode_error(f"Strict mode: line {number} has an invalid '=' escape.")


def _qp_line(line: str) -> bytes:
    out = bytearray()
    pos = 0
    for found in _QP_ESCAPE.finditer(line):
        out += utf8.encode(line[pos : found.start()])
        out.append(int(found.group(1), 16))
        pos = found.end()
    out += utf8.encode(line[pos:])
    return bytes(out)


# ---------------------------------------------------------------------------
# Base45 (RFC 9285)

B45 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
_B45_INDEX = {ch: i for i, ch in enumerate(B45)}


@operation(
    "to-base45",
    "To Base45",
    "Encoding",
    "bytes",
    "string",
    (),
    examples=(Example("AB", {}, "BB8"),),
)
def to_base45(data: bytes, _args: Args, ctx: OpContext) -> str:
    """Encode bytes as Base45 (RFC 9285), the QR-code encoding: 2 bytes become 3 characters."""
    out: list[str] = []
    for start in range(0, len(data), 2):
        if start % 8192 == 0:
            ctx.check()
        pair = data[start : start + 2]
        number = int.from_bytes(pair, "big")
        # Digits are written least significant first: 3 for a pair, 2 for a last single byte.
        for _ in range(len(pair) + 1):
            number, digit = divmod(number, 45)
            out.append(B45[digit])
    return "".join(out)


@operation(
    "from-base45",
    "From Base45",
    "Encoding",
    "string",
    "bytes",
    (bool_arg("strict"),),
    examples=(Example("BB8", {}, "AB"),),
)
def from_base45(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode Base45 (RFC 9285). Without `strict`, it skips characters outside the alphabet."""
    if args.flag("strict"):
        bad = next((ch for ch in text if ch not in _B45_INDEX), None)
        if bad is not None:
            raise _decode_error(f"Strict mode: {bad!r} is not a Base45 character.")
        chars = text
    else:
        chars = "".join(ch for ch in text if ch in _B45_INDEX)
    if len(chars) % 3 == 1:
        raise _decode_error("Base45 input cannot end with a single character.")
    out = bytearray()
    for start in range(0, len(chars), 3):
        if start % 8192 == 0:
            ctx.check()
        group = chars[start : start + 3]
        number = sum(_B45_INDEX[ch] * 45**i for i, ch in enumerate(group))
        size = len(group) - 1
        if number >= 256**size:
            raise _decode_error(f"Base45 group {group!r} is out of range.")
        out += number.to_bytes(size, "big")
    return bytes(out)


# ---------------------------------------------------------------------------
# Base62

B62 = {
    "upper-first": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    "lower-first": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
}
# Digits per big-integer step: 62**10 < 2**63.
_B62_STEP = 10
_B62_BASE = 62**_B62_STEP


@operation(
    "to-base62",
    "To Base62",
    "Encoding",
    "bytes",
    "string",
    (enum_arg("alphabet", tuple(B62)),),
    examples=(Example("Hello", {}, "5TP3P3v"),),
)
def to_base62(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write the bytes, read as one big-endian number, in base 62. Leading zeros are not kept."""
    alphabet = B62[args.text("alphabet")]
    if not data:
        return ""
    number = int.from_bytes(data, "big")
    chunks: list[str] = []
    while number:
        ctx.check()
        number, chunk = divmod(number, _B62_BASE)
        digits = []
        for _ in range(_B62_STEP):
            chunk, digit = divmod(chunk, 62)
            digits.append(alphabet[digit])
        chunks.append("".join(reversed(digits)))
    return "".join(reversed(chunks)).lstrip(alphabet[0]) or alphabet[0]


@operation(
    "from-base62",
    "From Base62",
    "Encoding",
    "string",
    "bytes",
    (enum_arg("alphabet", tuple(B62)), bool_arg("strict")),
    examples=(Example("5TP3P3v", {}, "Hello"),),
)
def from_base62(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode a base-62 number to bytes. Without `strict`, it skips other characters."""
    alphabet = B62[args.text("alphabet")]
    index = {ch: i for i, ch in enumerate(alphabet)}
    if args.flag("strict"):
        bad = next((ch for ch in text if ch not in index), None)
        if bad is not None:
            raise _decode_error(f"Strict mode: {bad!r} is not a Base62 digit.")
        chars = text
    else:
        chars = "".join(ch for ch in text if ch in index)
    if not chars:
        return b""
    number = 0
    for start in range(0, len(chars), _B62_STEP):
        ctx.check()
        part = chars[start : start + _B62_STEP]
        chunk = 0
        for ch in part:
            chunk = chunk * 62 + index[ch]
        number = number * 62 ** len(part) + chunk
    return number.to_bytes(max(1, (number.bit_length() + 7) // 8), "big")


# ---------------------------------------------------------------------------
# Base92

# '!', then '#' to '_' (61 characters), then 'a' to '}' (29): 91 digits.
# '"', '`' and '~' are unused.
B92 = "!" + "".join(map(chr, range(0x23, 0x60))) + "".join(map(chr, range(0x61, 0x7E)))
_B92_INDEX = {ch: i for i, ch in enumerate(B92)}
_B92_PAIR_BITS = 13  # two digits
_B92_TAIL_BITS = 6  # a final single digit
_BYTE_BITS = 8


@operation(
    "to-base92",
    "To Base92",
    "Encoding",
    "bytes",
    "string",
    (),
    examples=(Example("Hello", {}, ";K_$aOB"),),
)
def to_base92(data: bytes, _args: Args, ctx: OpContext) -> str:
    """Encode bytes as Base92: every 13 bits become two printable ASCII characters."""
    out: list[str] = []
    acc = bits = 0
    for i, byte in enumerate(data):
        if i % 8192 == 0:
            ctx.check()
        acc = (acc << _BYTE_BITS) | byte
        bits += _BYTE_BITS
        if bits >= _B92_PAIR_BITS:
            bits -= _B92_PAIR_BITS
            high, low = divmod(acc >> bits, 91)
            out += (B92[high], B92[low])
            acc &= (1 << bits) - 1
    if 0 < bits <= _B92_TAIL_BITS:
        out.append(B92[acc << (_B92_TAIL_BITS - bits)])
    elif bits:
        high, low = divmod(acc << (_B92_PAIR_BITS - bits), 91)
        out += (B92[high], B92[low])
    return "".join(out)


@operation(
    "from-base92",
    "From Base92",
    "Encoding",
    "string",
    "bytes",
    (bool_arg("strict"),),
    examples=(Example(";K_$aOB", {}, "Hello"),),
)
def from_base92(text: str, args: Args, ctx: OpContext) -> bytes:
    """Decode Base92. Without `strict`, it skips characters outside the alphabet."""
    if args.flag("strict"):
        bad = next((ch for ch in text if ch not in _B92_INDEX), None)
        if bad is not None:
            raise _decode_error(f"Strict mode: {bad!r} is not a Base92 character.")
        chars = text
    else:
        chars = "".join(ch for ch in text if ch in _B92_INDEX)
    out = bytearray()
    acc = bits = 0
    for start in range(0, len(chars), 2):
        if start % 8192 == 0:
            ctx.check()
        pair = chars[start : start + 2]
        if len(pair) > 1:
            value = _B92_INDEX[pair[0]] * 91 + _B92_INDEX[pair[1]]
            if value >= 1 << _B92_PAIR_BITS:
                raise _decode_error(f"Base92 pair {pair!r} is out of range.")
            acc, bits = (acc << _B92_PAIR_BITS) | value, bits + _B92_PAIR_BITS
        else:
            value = _B92_INDEX[pair]
            if value >= 1 << _B92_TAIL_BITS:
                raise _decode_error(f"Base92 final character {pair!r} is out of range.")
            acc, bits = (acc << _B92_TAIL_BITS) | value, bits + _B92_TAIL_BITS
        while bits >= _BYTE_BITS:
            bits -= _BYTE_BITS
            out.append(acc >> bits)
            acc &= (1 << bits) - 1
    return bytes(out)
