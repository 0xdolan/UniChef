# SPDX-License-Identifier: GPL-3.0-or-later
"""Hashing ops (PRD §3.8): digests and checksums as lower-case hex strings."""

import hashlib
import hmac as hmac_lib
import zlib
from collections.abc import Buffer, Callable
from typing import Protocol

from unichef.core.errors import UniChefError
from unichef.core.registry import Args, OpContext, bytes_arg, enum_arg, int_arg, operation

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


@operation("md5", "MD5", "Hashing", "bytes", "string")
def md5(data: bytes, _args: Args, ctx: OpContext) -> str:
    """MD5 digest (RFC 1321). Warns W_INSECURE."""
    _insecure(ctx, "MD5")
    return _digest("md5", data, ctx)


@operation("sha1", "SHA-1", "Hashing", "bytes", "string")
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


@operation("crc32", "CRC-32", "Hashing", "bytes", "string")
def crc32(data: bytes, _args: Args, ctx: OpContext) -> str:
    """CRC-32 (ISO-HDLC, as in zlib and PNG) as 8 hex digits."""
    return _checksum(zlib.crc32, 0, data, ctx)


@operation("adler32", "Adler-32", "Hashing", "bytes", "string")
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
)
def hmac(data: bytes, args: Args, ctx: OpContext) -> str:
    """HMAC (RFC 2104) with `hash` (default sha256) and a bytes `key`."""
    mac = hmac_lib.new(args.data("key"), digestmod=HMAC_HASHES[args.text("hash")])
    return _feed(mac, data, ctx).hexdigest()
