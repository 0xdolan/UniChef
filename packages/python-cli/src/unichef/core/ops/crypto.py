# SPDX-License-Identifier: GPL-3.0-or-later
"""Crypto ops (PRD §3.8): XOR, classical ciphers and AES."""

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import padding as sym_padding
from cryptography.hazmat.primitives.ciphers import Cipher, CipherContext, algorithms, modes

from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    OpContext,
    bool_arg,
    bytes_arg,
    enum_arg,
    int_arg,
    operation,
)

_CHUNK = 1 << 20
_BLOCK = 16
_GCM_TAG = 16
_KEY_SIZES = (16, 24, 32)
_GCM_NONCE = range(8, 129)
_ROT_LIMIT = 1_000_000
_PRINTABLE_FIRST, _PRINTABLE_COUNT = 0x21, 94
_BYTES = bytes(range(256))


def _crypto(message: str) -> UniChefError:
    return UniChefError("E_CRYPTO", message)


# ---------------------------------------------------------------------------
# XOR and classical ciphers


@operation(
    "xor",
    "XOR",
    "Crypto",
    "bytes",
    "bytes",
    (bytes_arg("key"), enum_arg("scheme", ("standard", "rolling"))),
)
def xor(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """XOR with a repeating `key`. `rolling` adds the number of completed passes over the
    key to each key byte (mod 256), so the key stream changes on every pass. Both schemes
    are their own inverse."""
    key = args.data("key")
    if not key:
        raise UniChefError("E_ARG_INVALID", "Argument 'key' must not be empty.")
    ctx.check()
    size, n = len(data), len(key)
    passes = -(-size // n)
    if args.text("scheme") == "standard":
        stream = (key * passes)[:size]
    else:  # key byte j on pass p is (key[j] + p) mod 256, a sequence of period 256
        buffer = bytearray(size)
        for j, k in enumerate(key[:size]):
            count = len(range(j, size, n))
            cycle = _BYTES[k:] + _BYTES[:k]
            buffer[j::n] = (cycle * -(-count // 256))[:count]
        stream = bytes(buffer)
    ctx.check()
    mixed = int.from_bytes(data, "big") ^ int.from_bytes(stream, "big")
    return mixed.to_bytes(size, "big")


def _rotate(ch: str, first: str, size: int, amount: int) -> str:
    return chr(ord(first) + (ord(ch) - ord(first) + amount) % size)


@operation(
    "rot13",
    "ROT13",
    "Crypto",
    "string",
    "string",
    (int_arg("amount", 13, -_ROT_LIMIT, _ROT_LIMIT), bool_arg("digits")),
)
def rot13(text: str, args: Args, _ctx: OpContext) -> str:
    """Rotate ASCII letters by `amount` (default 13, case kept); with `digits`, also
    rotate 0-9 by the same amount mod 10. Other characters are unchanged."""
    amount, digits = args.integer("amount"), args.flag("digits")

    def rotate(ch: str) -> str:
        if "a" <= ch <= "z":
            return _rotate(ch, "a", 26, amount)
        if "A" <= ch <= "Z":
            return _rotate(ch, "A", 26, amount)
        if digits and "0" <= ch <= "9":
            return _rotate(ch, "0", 10, amount)
        return ch

    return "".join(map(rotate, text))


@operation(
    "rot47",
    "ROT47",
    "Crypto",
    "string",
    "string",
    (int_arg("amount", 47, -_ROT_LIMIT, _ROT_LIMIT),),
)
def rot47(text: str, args: Args, _ctx: OpContext) -> str:
    """Rotate printable ASCII U+0021..U+007E by `amount` (default 47) mod 94."""
    amount = args.integer("amount")
    first = chr(_PRINTABLE_FIRST)
    return "".join(
        _rotate(ch, first, _PRINTABLE_COUNT, amount) if "!" <= ch <= "~" else ch for ch in text
    )


_ATBASH = str.maketrans(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    "ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba",
)


@operation("atbash", "Atbash", "Crypto", "string", "string")
def atbash(text: str, _args: Args, _ctx: OpContext) -> str:
    """Mirror the ASCII alphabet (A<->Z, case kept). Other characters are unchanged."""
    return text.translate(_ATBASH)


# ---------------------------------------------------------------------------
# AES

AES_MODES = ("cbc", "ctr", "gcm", "ecb")
AES_ARGS = (
    bytes_arg("key"),
    enum_arg("mode", AES_MODES),
    bytes_arg("iv"),
    enum_arg("padding", ("pkcs7", "none")),
    bytes_arg("aad"),
)


def _check_aad(args: Args) -> None:
    if args.data("aad") and args.text("mode") != "gcm":
        raise UniChefError("E_ARG_INVALID", "Argument 'aad' is only used in GCM mode.")


def _block_mode(args: Args, ctx: OpContext) -> modes.CBC | modes.CTR | modes.ECB:
    name = args.text("mode")
    if name == "ecb":
        ctx.warn("W_INSECURE", "ECB mode leaks patterns between identical blocks.")
        return modes.ECB()  # noqa: S305 - offered for analysis, with a warning
    iv = args.data("iv")
    if len(iv) != _BLOCK:
        raise _crypto(f"{name.upper()} needs a 16-byte IV, got {len(iv)} bytes.")
    return modes.CBC(iv) if name == "cbc" else modes.CTR(iv)


def _gcm(args: Args, tag: bytes | None = None) -> modes.GCM:
    iv = args.data("iv")
    if len(iv) not in _GCM_NONCE:
        raise _crypto(f"GCM needs an 8 to 128 byte IV (nonce), got {len(iv)} bytes.")
    return modes.GCM(iv, tag)


def _algorithm(args: Args) -> algorithms.AES:
    _check_aad(args)
    key = args.data("key")
    if len(key) not in _KEY_SIZES:
        raise _crypto(f"AES needs a 16, 24 or 32 byte key, got {len(key)} bytes.")
    return algorithms.AES(key)


def _padded(args: Args) -> bool:
    return args.text("mode") in {"cbc", "ecb"} and args.text("padding") == "pkcs7"


def _run(context: CipherContext, data: bytes, ctx: OpContext) -> bytes:
    view = memoryview(data)
    parts = []
    for start in range(0, len(data), _CHUNK):
        ctx.check()
        parts.append(context.update(view[start : start + _CHUNK]))
    parts.append(context.finalize())
    return b"".join(parts)


def _check_blocks(args: Args, size: int, what: str) -> None:
    if args.text("mode") in {"cbc", "ecb"} and size % _BLOCK:
        raise _crypto(f"{what} is {size} bytes, not a multiple of the 16-byte block.")


@operation("aes-encrypt", "AES Encrypt", "Crypto", "bytes", "bytes", AES_ARGS)
def aes_encrypt(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """AES in CBC (default), CTR, GCM or ECB mode. `padding` (PKCS#7 by default) applies
    to CBC and ECB. In GCM the 16-byte tag is appended and `aad` is authenticated. ECB
    warns W_INSECURE."""
    algorithm = _algorithm(args)
    if args.text("mode") == "gcm":
        sealer = Cipher(algorithm, _gcm(args)).encryptor()
        sealer.authenticate_additional_data(args.data("aad"))
        return _run(sealer, data, ctx) + sealer.tag
    encryptor = Cipher(algorithm, _block_mode(args, ctx)).encryptor()
    if _padded(args):
        padder = sym_padding.PKCS7(128).padder()
        data = padder.update(data) + padder.finalize()
    _check_blocks(args, len(data), "Input")
    return _run(encryptor, data, ctx)


@operation("aes-decrypt", "AES Decrypt", "Crypto", "bytes", "bytes", AES_ARGS)
def aes_decrypt(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Inverse of `aes-encrypt` with the same arguments. In GCM the last 16 bytes are the
    tag; a wrong key, IV, AAD or tag raises E_CRYPTO, as does bad PKCS#7 padding."""
    algorithm = _algorithm(args)
    if args.text("mode") == "gcm":
        if len(data) < _GCM_TAG:
            raise _crypto("GCM input is shorter than the 16-byte tag.")
        body, tag = data[:-_GCM_TAG], data[-_GCM_TAG:]
        opener = Cipher(algorithm, _gcm(args, tag)).decryptor()
        opener.authenticate_additional_data(args.data("aad"))
        try:
            return _run(opener, body, ctx)
        except InvalidTag as exc:
            raise _crypto("GCM authentication failed (wrong key, IV, AAD or tag).") from exc
    decryptor = Cipher(algorithm, _block_mode(args, ctx)).decryptor()
    _check_blocks(args, len(data), "Ciphertext")
    plain = _run(decryptor, data, ctx)
    if not _padded(args):
        return plain
    unpadder = sym_padding.PKCS7(128).unpadder()
    try:
        return unpadder.update(plain) + unpadder.finalize()
    except ValueError as exc:
        raise _crypto("Invalid PKCS#7 padding (wrong key or IV?).") from exc
