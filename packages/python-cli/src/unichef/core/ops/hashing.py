# SPDX-License-Identifier: GPL-3.0-or-later
"""Hashing ops (PRD §3.8): digests and checksums as lower-case hex strings."""

import hashlib
import hmac as hmac_lib
import zlib
from collections.abc import Buffer, Callable
from typing import Protocol

from unichef.core.errors import UniChefError
from unichef.core.registry import Args, Example, OpContext, bytes_arg, enum_arg, int_arg, operation

_CHUNK = 1 << 20


class _Hasher(Protocol):
    def update(self, data: Buffer, /) -> None: ...


def _feed[H: _Hasher](hasher: H, data: bytes, ctx: OpContext) -> H:
    """Hash in 1 MiB chunks so long inputs stay cancellable."""
    view = memoryview(data)
    for start in range(0, len(data), _CHUNK):
        ctx.check()
        hasher.update(view[start : start + _CHUNK])
    return hasher


def _digest(name: str, data: bytes, ctx: OpContext) -> str:
    return _feed(hashlib.new(name), data, ctx).hexdigest()


def _insecure(ctx: OpContext, name: str) -> None:
    ctx.warn("W_INSECURE", f"{name} is broken for collision resistance; do not rely on it.")


@operation(
    "md5",
    "MD5",
    "Hashing",
    "bytes",
    "string",
    examples=(Example("abc", {}, "900150983cd24fb0d6963f7d28e17f72"),),
)
def md5(data: bytes, _args: Args, ctx: OpContext) -> str:
    """MD5 digest (RFC 1321). Warns W_INSECURE."""
    _insecure(ctx, "MD5")
    return _digest("md5", data, ctx)


@operation(
    "sha1",
    "SHA-1",
    "Hashing",
    "bytes",
    "string",
    examples=(Example("abc", {}, "a9993e364706816aba3e25717850c26c9cd0d89d"),),
)
def sha1(data: bytes, _args: Args, ctx: OpContext) -> str:
    """SHA-1 digest (FIPS 180-4). Warns W_INSECURE."""
    _insecure(ctx, "SHA-1")
    return _digest("sha1", data, ctx)


SHA2_SIZES = {
    "256": "sha256",
    "224": "sha224",
    "384": "sha384",
    "512": "sha512",
    "512-224": "sha512_224",
    "512-256": "sha512_256",
}


@operation(
    "sha2",
    "SHA-2",
    "Hashing",
    "bytes",
    "string",
    (enum_arg("size", tuple(SHA2_SIZES)),),
    examples=(
        Example("abc", {}, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),
    ),
)
def sha2(data: bytes, args: Args, ctx: OpContext) -> str:
    """SHA-2 digest (FIPS 180-4); `size` is 256 (default), 224, 384, 512, 512-224 or
    512-256."""
    return _digest(SHA2_SIZES[args.text("size")], data, ctx)


@operation(
    "sha3",
    "SHA-3",
    "Hashing",
    "bytes",
    "string",
    (enum_arg("size", ("256", "224", "384", "512")),),
    examples=(
        Example("abc", {}, "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"),
    ),
)
def sha3(data: bytes, args: Args, ctx: OpContext) -> str:
    """SHA-3 digest (FIPS 202); `size` is 256 (default), 224, 384 or 512."""
    return _digest(f"sha3_{args.text('size')}", data, ctx)


@operation(
    "shake",
    "SHAKE",
    "Hashing",
    "bytes",
    "string",
    (enum_arg("size", ("128", "256")), int_arg("length", 32, 1, 65536)),
    examples=(Example("abc", {"length": 16}, "5881092dd818bf5cf8a3ddb793fbcba7"),),
)
def shake(data: bytes, args: Args, ctx: OpContext) -> str:
    """SHAKE extendable-output function (FIPS 202); `size` is 128 (default) or 256 and
    `length` is the output length in bytes (default 32)."""
    hasher = hashlib.shake_128() if args.text("size") == "128" else hashlib.shake_256()
    return _feed(hasher, data, ctx).hexdigest(args.integer("length"))


def _blake2(
    factory: Callable[..., "hashlib.blake2b | hashlib.blake2s"],
    max_size: int,
    data: bytes,
    args: Args,
    ctx: OpContext,
) -> str:
    key = args.data("key")
    if len(key) > max_size:
        raise UniChefError("E_ARG_INVALID", f"Argument 'key' is longer than {max_size} bytes.")
    return _feed(factory(digest_size=args.integer("size"), key=key), data, ctx).hexdigest()


@operation(
    "blake2b",
    "BLAKE2b",
    "Hashing",
    "bytes",
    "string",
    (int_arg("size", 64, 1, 64), bytes_arg("key")),
    examples=(
        Example(
            "abc", {"size": 32}, "bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319"
        ),
    ),
)
def blake2b(data: bytes, args: Args, ctx: OpContext) -> str:
    """BLAKE2b (RFC 7693); `size` is the digest length in bytes (1-64, default 64) and
    `key` an optional key of up to 64 bytes."""
    return _blake2(hashlib.blake2b, 64, data, args, ctx)


@operation(
    "blake2s",
    "BLAKE2s",
    "Hashing",
    "bytes",
    "string",
    (int_arg("size", 32, 1, 32), bytes_arg("key")),
    examples=(
        Example("abc", {}, "508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982"),
    ),
)
def blake2s(data: bytes, args: Args, ctx: OpContext) -> str:
    """BLAKE2s (RFC 7693); `size` is the digest length in bytes (1-32, default 32) and
    `key` an optional key of up to 32 bytes."""
    return _blake2(hashlib.blake2s, 32, data, args, ctx)


def _checksum(fn: Callable[[Buffer, int], int], start: int, data: bytes, ctx: OpContext) -> str:
    value = start
    view = memoryview(data)
    for offset in range(0, len(data), _CHUNK):
        ctx.check()
        value = fn(view[offset : offset + _CHUNK], value)
    return f"{value:08x}"


@operation(
    "crc32",
    "CRC-32",
    "Hashing",
    "bytes",
    "string",
    examples=(Example("The quick brown fox jumps over the lazy dog", {}, "414fa339"),),
)
def crc32(data: bytes, _args: Args, ctx: OpContext) -> str:
    """CRC-32 (ISO-HDLC, as in zlib and PNG) as 8 hex digits."""
    return _checksum(zlib.crc32, 0, data, ctx)


@operation(
    "adler32",
    "Adler-32",
    "Hashing",
    "bytes",
    "string",
    examples=(Example("Wikipedia", {}, "11e60398"),),
)
def adler32(data: bytes, _args: Args, ctx: OpContext) -> str:
    """Adler-32 (RFC 1950) as 8 hex digits."""
    return _checksum(zlib.adler32, 1, data, ctx)


HMAC_HASHES = {
    "sha256": "sha256",
    "sha1": "sha1",
    "md5": "md5",
    "sha224": "sha224",
    "sha384": "sha384",
    "sha512": "sha512",
    "sha3-256": "sha3_256",
    "sha3-512": "sha3_512",
}


@operation(
    "hmac",
    "HMAC",
    "Hashing",
    "bytes",
    "string",
    (enum_arg("hash", tuple(HMAC_HASHES)), bytes_arg("key")),
    examples=(
        Example(
            "message",
            {"key": {"encoding": "utf8", "value": "secret"}},
            "8b5f48702995c1598c573db1e21866a9b825d4a794d169d7060a03605796360b",
        ),
    ),
)
def hmac(data: bytes, args: Args, ctx: OpContext) -> str:
    """HMAC (RFC 2104) with `hash` (default sha256) and a bytes `key`."""
    mac = hmac_lib.new(args.data("key"), digestmod=HMAC_HASHES[args.text("hash")])
    return _feed(mac, data, ctx).hexdigest()
