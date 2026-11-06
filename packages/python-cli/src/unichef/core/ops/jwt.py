# SPDX-License-Identifier: GPL-3.0-or-later
"""JSON Web Token ops (RFC 7519, JWS compact serialisation RFC 7515, algorithms RFC 7518
and RFC 8037): decode, sign and verify."""

import base64
import binascii
import hashlib
import hmac
import re
from typing import cast

from cryptography import x509
from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed448, ed25519, padding, rsa
from cryptography.hazmat.primitives.asymmetric.utils import (
    decode_dss_signature,
    encode_dss_signature,
)

from unichef.core.dish import JsonValue, json_dumps, json_loads
from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    OpContext,
    bytes_arg,
    enum_arg,
    operation,
    string_arg,
)

ALGORITHMS = (
    "HS256",
    "HS384",
    "HS512",
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512",
    "EdDSA",
)
_HASHES: dict[str, type[hashes.HashAlgorithm]] = {
    "256": hashes.SHA256,
    "384": hashes.SHA384,
    "512": hashes.SHA512,
}
_CURVES: dict[str, tuple[type[ec.EllipticCurve], int]] = {
    "ES256": (ec.SECP256R1, 32),
    "ES384": (ec.SECP384R1, 48),
    "ES512": (ec.SECP521R1, 66),
}
_MIN_RSA_BITS = 2048
_B64URL = re.compile(r"[A-Za-z0-9_-]*")
_SEGMENTS = 3
_JWE_SEGMENTS = 5

type PrivateKey = (
    rsa.RSAPrivateKey
    | ec.EllipticCurvePrivateKey
    | ed25519.Ed25519PrivateKey
    | (ed448.Ed448PrivateKey)
)
type PublicKey = (
    rsa.RSAPublicKey | ec.EllipticCurvePublicKey | ed25519.Ed25519PublicKey | (ed448.Ed448PublicKey)
)


def _crypto(message: str) -> UniChefError:
    return UniChefError("E_CRYPTO", message)


def _decode_error(message: str) -> UniChefError:
    return UniChefError("E_DECODE", message)


# ---------------------------------------------------------------------------
# Compact serialisation


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(text: str, what: str) -> bytes:
    """Strict unpadded base64url: no padding, no whitespace, zero trailing bits."""
    if not _B64URL.fullmatch(text) or len(text) % 4 == 1:
        raise _decode_error(f"The {what} is not valid unpadded base64url.")
    try:
        data = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    except binascii.Error as exc:  # pragma: no cover - excluded by the checks above
        raise _decode_error(f"The {what} is not valid unpadded base64url.") from exc
    if b64url_encode(data) != text:
        raise _decode_error(f"The {what} has non-zero trailing bits.")
    return data


def _json_object(raw: bytes, what: str, ctx: OpContext) -> dict[str, JsonValue]:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise _decode_error(f"The {what} is not valid UTF-8.") from exc
    try:
        value = json_loads(text, ctx.warn)
    except UniChefError as exc:
        raise _decode_error(f"The {what} is not valid JSON.") from exc
    if not isinstance(value, dict):
        raise _decode_error(f"The {what} is not a JSON object.")
    return value


class _Token:
    __slots__ = ("header", "payload", "signature", "signing_input")

    def __init__(self, text: str, ctx: OpContext) -> None:
        token = text.strip(" \t\n\r")
        parts = token.split(".")
        if len(parts) == _JWE_SEGMENTS:
            raise _decode_error("Encrypted tokens (JWE, five segments) are not supported.")
        if len(parts) != _SEGMENTS:
            raise _decode_error(f"A JWT has three dot-separated segments, found {len(parts)}.")
        self.header = _json_object(b64url_decode(parts[0], "header"), "header", ctx)
        self.payload = _json_object(b64url_decode(parts[1], "payload"), "payload", ctx)
        self.signature = b64url_decode(parts[2], "signature")
        self.signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")


# ---------------------------------------------------------------------------
# Keys


def _hmac_key(alg: str, args: Args, ctx: OpContext) -> bytes:
    key = args.data("key")
    if not key:
        raise UniChefError("E_ARG_INVALID", "Argument 'key' (the HMAC secret) is empty.")
    bits = int(alg[2:])
    if len(key) * 8 < bits:
        ctx.warn(
            "W_INSECURE",
            f"{alg} secret is {len(key) * 8} bits; RFC 7518 requires at least {bits}.",
        )
    return key


def _load_private(key: bytes) -> PrivateKey:
    loader = (
        serialization.load_pem_private_key
        if key.lstrip().startswith(b"-----")
        else serialization.load_der_private_key
    )
    try:
        loaded = loader(key, password=None)
    except (ValueError, TypeError, UnsupportedAlgorithm) as exc:
        raise _crypto("Argument 'key' is not an unencrypted PEM or DER private key.") from exc
    if not isinstance(
        loaded,
        rsa.RSAPrivateKey
        | ec.EllipticCurvePrivateKey
        | ed25519.Ed25519PrivateKey
        | ed448.Ed448PrivateKey,
    ):
        raise _crypto("The private key type is not used by any JWS algorithm.")
    return loaded


def _load_public(key: bytes) -> PublicKey:
    """A public key, a certificate, or a private key (its public half is used)."""
    pem = key.lstrip().startswith(b"-----")
    loaded: object = None
    if pem and b"CERTIFICATE" in key:
        try:
            loaded = x509.load_pem_x509_certificate(key).public_key()
        except ValueError as exc:
            raise _crypto("Argument 'key' is not a valid PEM certificate.") from exc
    elif pem and b"PRIVATE KEY" in key:
        loaded = _load_private(key).public_key()
    else:
        loader = serialization.load_pem_public_key if pem else serialization.load_der_public_key
        try:
            loaded = loader(key)
        except (ValueError, UnsupportedAlgorithm) as exc:
            raise _crypto("Argument 'key' is not a PEM or DER public key.") from exc
    if not isinstance(
        loaded,
        rsa.RSAPublicKey
        | ec.EllipticCurvePublicKey
        | ed25519.Ed25519PublicKey
        | ed448.Ed448PublicKey,
    ):
        raise _crypto("The public key type is not used by any JWS algorithm.")
    return loaded


def _check_key(alg: str, key: PrivateKey | PublicKey, ctx: OpContext) -> None:
    family = alg[:2]
    if family in {"RS", "PS"}:
        if not isinstance(key, rsa.RSAPrivateKey | rsa.RSAPublicKey):
            raise _crypto(f"{alg} needs an RSA key.")
        if key.key_size < _MIN_RSA_BITS:
            ctx.warn("W_INSECURE", f"RSA key is {key.key_size} bits; use at least 2048.")
    elif family == "ES":
        curve = _CURVES[alg][0]
        if not isinstance(key, ec.EllipticCurvePrivateKey | ec.EllipticCurvePublicKey) or (
            not isinstance(key.curve, curve)
        ):
            raise _crypto(f"{alg} needs an EC key on curve {curve.name}.")
    elif not isinstance(
        key,
        ed25519.Ed25519PrivateKey
        | ed25519.Ed25519PublicKey
        | ed448.Ed448PrivateKey
        | ed448.Ed448PublicKey,
    ):
        raise _crypto("EdDSA needs an Ed25519 or Ed448 key.")


# ---------------------------------------------------------------------------
# Signatures


def _rsa_padding(alg: str) -> padding.AsymmetricPadding:
    if alg.startswith("RS"):
        return padding.PKCS1v15()
    digest = _HASHES[alg[2:]]()
    return padding.PSS(mgf=padding.MGF1(digest), salt_length=digest.digest_size)


def _sign(alg: str, message: bytes, args: Args, ctx: OpContext) -> bytes:
    if alg.startswith("HS"):
        key = _hmac_key(alg, args, ctx)
        return hmac.new(key, message, getattr(hashlib, f"sha{alg[2:]}")).digest()
    private = _load_private(args.data("key"))
    _check_key(alg, private, ctx)
    if isinstance(private, rsa.RSAPrivateKey):
        return private.sign(message, _rsa_padding(alg), _HASHES[alg[2:]]())
    if isinstance(private, ec.EllipticCurvePrivateKey):
        size = _CURVES[alg][1]
        r, s = decode_dss_signature(private.sign(message, ec.ECDSA(_HASHES[alg[2:]]())))
        return r.to_bytes(size, "big") + s.to_bytes(size, "big")
    return private.sign(message)


def _verify(alg: str, message: bytes, signature: bytes, args: Args, ctx: OpContext) -> bool:
    if alg.startswith("HS"):
        key = _hmac_key(alg, args, ctx)
        expected = hmac.new(key, message, getattr(hashlib, f"sha{alg[2:]}")).digest()
        return hmac.compare_digest(expected, signature)
    public = _load_public(args.data("key"))
    _check_key(alg, public, ctx)
    try:
        if isinstance(public, rsa.RSAPublicKey):
            public.verify(signature, message, _rsa_padding(alg), _HASHES[alg[2:]]())
        elif isinstance(public, ec.EllipticCurvePublicKey):
            size = _CURVES[alg][1]
            if len(signature) != 2 * size:
                return False
            r = int.from_bytes(signature[:size], "big")
            s = int.from_bytes(signature[size:], "big")
            public.verify(encode_dss_signature(r, s), message, ec.ECDSA(_HASHES[alg[2:]]()))
        else:
            public.verify(signature, message)
    except InvalidSignature:
        return False
    return True


# ---------------------------------------------------------------------------
# Operations


@operation("jwt-decode", "JWT Decode", "Crypto", "string", "json")
def jwt_decode(text: str, _args: Args, ctx: OpContext) -> JsonValue:
    """Split a JWT into `header`, `payload` and `signature` (base64url text), without
    checking the signature or time claims. Surrounding whitespace is ignored."""
    token = _Token(text, ctx)
    return {
        "header": token.header,
        "payload": token.payload,
        "signature": b64url_encode(token.signature),
    }


@operation(
    "jwt-sign",
    "JWT Sign",
    "Crypto",
    "json",
    "string",
    (
        enum_arg("algorithm", (*ALGORITHMS, "none")),
        bytes_arg("key", encodings=("utf8", "hex", "base64", "latin1")),
        string_arg("header", multiline=True),
    ),
    parity="roundtrip",
)
def jwt_sign(payload: JsonValue, args: Args, ctx: OpContext) -> str:
    """Sign a JSON object as a JWT. `key` is the HMAC secret for HS*, or a PEM/DER private
    key. `header` adds JSON fields after `alg` and `typ` ("JWT"); it may replace `typ` but
    not `alg`. PS* and ES* signatures are randomised; `none` warns W_INSECURE."""
    if not isinstance(payload, dict):
        raise UniChefError("E_INPUT_TYPE", "The JWT payload must be a JSON object.")
    alg = args.text("algorithm")
    header: dict[str, JsonValue] = {"alg": alg, "typ": "JWT"}
    if extra_text := args.text("header").strip():
        try:
            extra = json_loads(extra_text, ctx.warn)
        except UniChefError as exc:
            raise UniChefError("E_ARG_INVALID", "Argument 'header' is not valid JSON.") from exc
        if not isinstance(extra, dict):
            raise UniChefError("E_ARG_INVALID", "Argument 'header' must be a JSON object.")
        if "alg" in extra and extra["alg"] != alg:
            raise UniChefError("E_ARG_INVALID", "Set 'alg' with the 'algorithm' argument.")
        header.update(extra)
    encoded = (
        b64url_encode(json_dumps(header).encode("utf-8"))
        + "."
        + b64url_encode(json_dumps(payload).encode("utf-8"))
    )
    if alg == "none":
        ctx.warn("W_INSECURE", "Unsecured JWT (alg 'none') carries no signature.")
        return encoded + "."
    return encoded + "." + b64url_encode(_sign(alg, encoded.encode("ascii"), args, ctx))


@operation(
    "jwt-verify",
    "JWT Verify",
    "Crypto",
    "string",
    "json",
    (
        enum_arg("algorithm", ALGORITHMS),
        bytes_arg("key", encodings=("utf8", "hex", "base64", "latin1")),
    ),
)
def jwt_verify(text: str, args: Args, ctx: OpContext) -> JsonValue:
    """Check a JWT's signature and return its payload. The header `alg` must equal
    `algorithm` (so `none` and algorithm swaps are refused). `key` is the HMAC secret, or
    a PEM/DER public key, certificate or private key. Tokens with `crit` are refused.
    Time claims (`exp`, `nbf`) are not checked. Failures raise E_CRYPTO."""
    token = _Token(text, ctx)
    alg = args.text("algorithm")
    if token.header.get("alg") != alg:
        found = token.header.get("alg")
        raise _crypto(f"Header alg is {json_dumps(found)}, expected {json_dumps(alg)}.")
    if "crit" in token.header:
        raise _crypto("The token has critical header extensions ('crit'), not supported.")
    ctx.check()
    if not _verify(alg, token.signing_input, token.signature, args, ctx):
        raise _crypto("Invalid signature.")
    return cast(JsonValue, token.payload)
