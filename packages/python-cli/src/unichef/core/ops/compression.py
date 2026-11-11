# SPDX-License-Identifier: GPL-3.0-or-later
"""Compression operations: raw DEFLATE, zlib and gzip (PRD §3.8 Beta; spec/README.md).

Compressed output at levels 1-9 comes from the host zlib, so it may differ from the
TypeScript core byte for byte (parity class ``roundtrip``). Level 0, the zlib and gzip
framing, and every decoder decision are written here and match the TypeScript core
exactly.
"""

import zlib

from unichef.core.errors import UniChefError
from unichef.core.registry import Args, Example, OpContext, int_arg, operation

CHUNK = 1 << 20  # bytes compressed between cancellation checks
STORED_MAX = 0xFFFF  # largest stored block (RFC 1951 §3.2.4)
DEFAULT_LEVEL = 6
U16 = 0xFFFF

ZLIB_CMF = 0x78  # deflate, 32 KiB window
ZLIB_FDICT = 0x20
ZLIB_CHECK = 31
ZLIB_MAX_CINFO = 7
DEFLATE_CM = 8

GZIP_MAGIC = b"\x1f\x8b"
GZIP_HEADER = 10
GZIP_TRAILER = 8
GZIP_OS_UNKNOWN = 255
FHCRC, FEXTRA, FNAME, FCOMMENT, FRESERVED = 0x02, 0x04, 0x08, 0x10, 0xE0
XFL_SLOWEST, XFL_FASTEST = 2, 4
LEVEL_FASTEST, LEVEL_BEST = 1, 9


def _level(args: Args) -> int:
    return args.integer("level")


def _deflate_raw(data: bytes, level: int, ctx: OpContext) -> bytes:
    if level == 0:
        return _stored(data, ctx)
    comp = zlib.compressobj(level, zlib.DEFLATED, -15)
    out: list[bytes] = []
    for i in range(0, len(data), CHUNK):
        ctx.check()
        out.append(comp.compress(data[i : i + CHUNK]))
    out.append(comp.flush())
    return b"".join(out)


def _stored(data: bytes, ctx: OpContext) -> bytes:
    """Stored blocks of at most 65535 bytes; empty input is one empty final block."""
    out = bytearray()
    starts = range(0, len(data), STORED_MAX) if data else range(1)
    for i in starts:
        if i % CHUNK < STORED_MAX:
            ctx.check()
        block = data[i : i + STORED_MAX]
        final = i + STORED_MAX >= len(data)
        size = len(block)
        out += bytes([1 if final else 0])
        out += size.to_bytes(2, "little") + (size ^ U16).to_bytes(2, "little") + block
    return bytes(out)


def _inflate_raw(data: bytes, limit: int, op: str) -> tuple[bytes, int]:
    """Inflate one DEFLATE stream at the start of ``data``. Returns the output and the
    number of input bytes the stream used. ``limit`` caps the output (E_LIMIT)."""
    inflater = zlib.decompressobj(-15)
    try:
        out = inflater.decompress(data, limit + 1)
    except zlib.error as exc:
        reason = str(exc).rpartition(": ")[2]  # drop zlib's "Error -3 while decompressing data"
        raise UniChefError("E_DECODE", f"Invalid DEFLATE data: {reason}.") from None
    if len(out) > limit:
        raise UniChefError("E_LIMIT", f"{op} produced more than {limit} units of output.")
    if not inflater.eof:
        raise UniChefError("E_DECODE", "The DEFLATE stream is incomplete.")
    return out, len(data) - len(inflater.unused_data)


def _no_trailing(data: bytes, pos: int) -> None:
    if pos != len(data):
        extra = len(data) - pos
        raise UniChefError("E_DECODE", f"{extra} byte{'s' * (extra != 1)} of trailing data.")


def _zlib_flg(level: int) -> int:
    """FLG with FLEVEL chosen as zlib chooses it (0-1, 2-5, 6, 7-9), plus the check bits."""
    flevel = sum(level >= t for t in (2, DEFAULT_LEVEL, DEFAULT_LEVEL + 1))
    flg = flevel << 6
    return flg + (-(ZLIB_CMF << 8 | flg)) % ZLIB_CHECK


@operation(
    "raw-deflate",
    "Raw Deflate",
    "Compression",
    "bytes",
    "bytes",
    (int_arg("level", DEFAULT_LEVEL, 0, 9),),
    parity="roundtrip",
    examples=(Example("Hi", {"level": 0}, "01 02 00 fd ff 48 69"),),
)
def raw_deflate(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Compress to a raw DEFLATE stream (RFC 1951) with no header or checksum. Level 0
    stores the input uncompressed; 1 is fastest and 9 smallest."""
    return _deflate_raw(data, _level(args), ctx)


@operation(
    "raw-inflate",
    "Raw Inflate",
    "Compression",
    "bytes",
    "bytes",
    examples=(Example("K\x04\x00", {}, "a"),),
)
def raw_inflate(data: bytes, _args: Args, ctx: OpContext) -> bytes:
    """Decompress a raw DEFLATE stream (RFC 1951). The stream must be complete, and no
    bytes may follow it."""
    out, used = _inflate_raw(data, ctx.limits.output_limit(len(data)), "raw-inflate")
    _no_trailing(data, used)
    return out


@operation(
    "zlib-deflate",
    "Zlib Deflate",
    "Compression",
    "bytes",
    "bytes",
    (int_arg("level", DEFAULT_LEVEL, 0, 9),),
    parity="roundtrip",
    examples=(Example("Hi", {"level": 0}, "78 01 01 02 00 fd ff 48 69 00 fb 00 b2"),),
)
def zlib_deflate(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Compress to the zlib format (RFC 1950): a 2-byte header, raw DEFLATE and an
    Adler-32 checksum."""
    level = _level(args)
    body = _deflate_raw(data, level, ctx)
    check = zlib.adler32(data).to_bytes(4, "big")
    return bytes([ZLIB_CMF, _zlib_flg(level)]) + body + check


@operation(
    "zlib-inflate",
    "Zlib Inflate",
    "Compression",
    "bytes",
    "bytes",
    examples=(Example("x\x01K\x04\x00\x00b\x00b", {}, "a"),),
)
def zlib_inflate(data: bytes, _args: Args, ctx: OpContext) -> bytes:
    """Decompress zlib data (RFC 1950) and check its Adler-32. A preset dictionary is not
    supported, and no bytes may follow the checksum."""
    _need(data, 2, "zlib header")
    cmf, flg = data[0], data[1]
    if (cmf << 8 | flg) % ZLIB_CHECK:
        raise UniChefError("E_DECODE", "The zlib header check failed.")
    if cmf & 0x0F != DEFLATE_CM or cmf >> 4 > ZLIB_MAX_CINFO:
        raise UniChefError("E_DECODE", "The zlib header names an unknown method or window.")
    if flg & ZLIB_FDICT:
        raise UniChefError("E_DECODE", "zlib data with a preset dictionary is not supported.")
    out, used = _inflate_raw(data[2:], ctx.limits.output_limit(len(data)), "zlib-inflate")
    pos = 2 + used
    _need(data, pos + 4, "zlib checksum")
    if int.from_bytes(data[pos : pos + 4], "big") != zlib.adler32(out):
        raise UniChefError("E_DECODE", "The zlib Adler-32 checksum does not match.")
    _no_trailing(data, pos + 4)
    return out


@operation(
    "gzip",
    "Gzip",
    "Compression",
    "bytes",
    "bytes",
    (int_arg("level", DEFAULT_LEVEL, 0, 9),),
    parity="roundtrip",
    examples=(
        Example(
            "Hi",
            {"level": 0},
            "1f 8b 08 00 00 00 00 00 00 ff 01 02 00 fd ff 48 69 0e 0e 17 4d 02 00 00 00",
        ),
    ),
)
def gzip(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Compress to one gzip member (RFC 1952) with no file name, a zero modification time
    and OS 255 (unknown), so the output does not depend on when or where it is made."""
    level = _level(args)
    xfl = XFL_SLOWEST if level == LEVEL_BEST else XFL_FASTEST if level == LEVEL_FASTEST else 0
    header = GZIP_MAGIC + bytes([DEFLATE_CM, 0, 0, 0, 0, 0, xfl, GZIP_OS_UNKNOWN])
    body = _deflate_raw(data, level, ctx)
    trailer = zlib.crc32(data).to_bytes(4, "little") + (len(data) & 0xFFFFFFFF).to_bytes(
        4, "little"
    )
    return header + body + trailer


def _need(data: bytes, end: int, what: str) -> None:
    if len(data) < end:
        raise UniChefError("E_DECODE", f"The {what} is incomplete.")


def _gzip_header(data: bytes, start: int) -> int:
    """Check one member header at ``start``; return where its DEFLATE data begins."""
    if data[start : start + 2] != GZIP_MAGIC:
        raise UniChefError("E_DECODE", f"No gzip header at byte {start}.")
    _need(data, start + GZIP_HEADER, "gzip header")
    if data[start + 2] != DEFLATE_CM:
        raise UniChefError("E_DECODE", "The gzip header names an unknown method.")
    flg = data[start + 3]
    if flg & FRESERVED:
        raise UniChefError("E_DECODE", "The gzip header sets reserved flags.")
    pos = start + GZIP_HEADER
    if flg & FEXTRA:
        _need(data, pos + 2, "gzip header")
        pos += 2 + int.from_bytes(data[pos : pos + 2], "little")
    for flag in (FNAME, FCOMMENT):
        if flg & flag:
            end = data.find(b"\x00", min(pos, len(data)))
            pos = end + 1 if end >= 0 else len(data) + 1
    if flg & FHCRC:
        _need(data, pos + 2, "gzip header")
        if int.from_bytes(data[pos : pos + 2], "little") != zlib.crc32(data[start:pos]) & U16:
            raise UniChefError("E_DECODE", "The gzip header CRC does not match.")
        pos += 2
    _need(data, pos, "gzip header")
    return pos


@operation("gunzip", "Gunzip", "Compression", "bytes", "bytes")
def gunzip(data: bytes, _args: Args, ctx: OpContext) -> bytes:
    """Decompress gzip data (RFC 1952), member after member, checking each CRC-32 and
    length. Anything after the last member that is not another member is an error."""
    limit = ctx.limits.output_limit(len(data))
    out = bytearray()
    pos = 0
    while True:
        ctx.check()
        pos = _gzip_header(data, pos)
        member, used = _inflate_raw(data[pos:], limit - len(out), "gunzip")
        pos += used
        _need(data, pos + GZIP_TRAILER, "gzip trailer")
        if int.from_bytes(data[pos : pos + 4], "little") != zlib.crc32(member):
            raise UniChefError("E_DECODE", "The gzip CRC-32 does not match.")
        if int.from_bytes(data[pos + 4 : pos + 8], "little") != len(member) & 0xFFFFFFFF:
            raise UniChefError("E_DECODE", "The gzip length does not match.")
        out += member
        pos += GZIP_TRAILER
        if pos == len(data):
            return bytes(out)
