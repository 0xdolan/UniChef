# SPDX-License-Identifier: GPL-3.0-or-later
"""Punycode (RFC 3492) and IDNA (UTS #46, nontransitional) ops (PRD §3.8 Beta;
spec/README.md)."""

from unichef.core.errors import UniChefError
from unichef.core.registry import Args, Example, OpContext, bool_arg, operation
from unichef.unicode import idna

UTS46_ARGS = (
    bool_arg("check_hyphens", True),
    bool_arg("check_bidi", True),
    bool_arg("check_joiners", True),
    bool_arg("use_std3_ascii_rules", True),
)


def _flags(args: Args) -> idna.Flags:
    return idna.Flags(
        check_hyphens=args.flag("check_hyphens"),
        check_bidi=args.flag("check_bidi"),
        check_joiners=args.flag("check_joiners"),
        use_std3_ascii_rules=args.flag("use_std3_ascii_rules"),
    )


@operation(
    "to-punycode",
    "To Punycode",
    "Encoding",
    "string",
    "string",
    (bool_arg("domain", False),),
    examples=(
        Example("münchen", {}, "mnchen-3ya"),
        Example("bücher.example", {"domain": True}, "xn--bcher-kva.example"),
    ),
)
def to_punycode(text: str, args: Args, ctx: OpContext) -> str:
    """Encode the input with Punycode (RFC 3492). With `domain`, split it into labels at
    full stops (U+002E, U+3002, U+FF0E, U+FF61), encode each label that has a non-ASCII
    character as xn-- plus Punycode, and join the labels with U+002E. No mapping or
    checks are applied; use idna-to-ascii for that."""
    try:
        if args.flag("domain"):
            return idna.domain_to_punycode(text, ctx.check)
        return idna.punycode_encode(text, ctx.check)
    except idna.PunycodeError as exc:
        raise UniChefError("E_LIMIT", str(exc)) from None


@operation(
    "from-punycode",
    "From Punycode",
    "Encoding",
    "string",
    "string",
    (bool_arg("domain", False),),
    examples=(
        Example("mnchen-3ya", {}, "münchen"),
        Example("xn--bcher-kva.example", {"domain": True}, "bücher.example"),
    ),
)
def from_punycode(text: str, args: Args, ctx: OpContext) -> str:
    """Decode Punycode (RFC 3492). With `domain`, split the input into labels as
    to-punycode does and decode each label that starts with xn-- (any case)."""
    try:
        if args.flag("domain"):
            return idna.domain_from_punycode(text, ctx.check)
        return idna.punycode_decode(text, ctx.check)
    except idna.PunycodeError as exc:
        raise UniChefError("E_DECODE", f"Invalid Punycode: {exc}") from None


@operation(
    "idna-to-ascii",
    "IDNA To ASCII",
    "Encoding",
    "string",
    "string",
    (*UTS46_ARGS, bool_arg("verify_dns_length", True)),
    examples=(
        Example("Bücher.Example", {}, "xn--bcher-kva.example"),
        Example("faß.de", {}, "xn--fa-hia.de"),
    ),
)
def idna_to_ascii(text: str, args: Args, ctx: OpContext) -> str:
    """UTS #46 ToASCII with nontransitional processing: map, normalise to NFC, check
    every label, and encode non-ASCII labels as xn-- plus Punycode. Any error fails the
    op with E_DECODE, naming the first error found. `verify_dns_length` requires labels
    of 1 to 63 characters and a name of 1 to 253 (not counting a final dot)."""
    ctx.check()
    return idna.to_ascii(text, _flags(args), args.flag("verify_dns_length"), ctx.check)


@operation(
    "idna-to-unicode",
    "IDNA To Unicode",
    "Encoding",
    "string",
    "string",
    UTS46_ARGS,
    examples=(
        Example("xn--bcher-kva.example", {}, "bücher.example"),
        Example("XN--FA-HIA.DE", {}, "faß.de"),
    ),
)
def idna_to_unicode(text: str, args: Args, ctx: OpContext) -> str:
    """UTS #46 ToUnicode with nontransitional processing: map, normalise to NFC, decode
    xn-- labels and check every label. Any error fails the op with E_DECODE, naming the
    first error found."""
    ctx.check()
    return idna.to_unicode(text, _flags(args))
