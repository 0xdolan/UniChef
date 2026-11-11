# SPDX-License-Identifier: GPL-3.0-or-later
"""Security detection ops (PRD §4.7): invisible characters, bidi controls, UTS #39
confusables and restriction levels."""

from unichef.core.dish import Cell, Table
from unichef.core.registry import Args, Example, OpContext, bool_arg, operation, string_arg
from unichef.unicode import confusables, names, props

_LF = 0x0A
_ASCII_END = 0x80
_TAGS = range(0xE0000, 0xE0080)
_ZERO_WIDTH = frozenset({0x180E, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF})
_HANGUL_FILLERS = frozenset({0x115F, 0x1160, 0x3164, 0xFFA0})
_EXTRA = frozenset({0x00AD, 0x034F}) | _HANGUL_FILLERS

INVISIBLE_COLUMNS = ("index", "cp", "name", "kind", "line", "column")
CONFUSABLE_COLUMNS = ("index", "cp", "name", "prototype")
COMPARE_COLUMNS = ("input-skeleton", "reference-skeleton", "confusable")

RESTRICTION_LEVELS = (
    "ASCII-Only",
    "Single Script",
    "Highly Restrictive",
    "Moderately Restrictive",
    "Minimally Restrictive",
    "Unrestricted",
)
_CJK_SETS = frozenset({"Hanb", "Jpan", "Kore"})


def invisible_kind(cp: int) -> str | None:
    """The finding kind for ``cp`` (first match in this order), or None when it is not
    an invisible character."""
    checks = (
        ("bidi-control", props.has("Bidi_Control", cp)),
        ("tag", cp in _TAGS),
        ("variation-selector", props.has("Variation_Selector", cp)),
        ("zero-width", cp in _ZERO_WIDTH),
        ("hangul-filler", cp in _HANGUL_FILLERS),
        ("default-ignorable", cp in _EXTRA or props.has("Default_Ignorable_Code_Point", cp)),
    )
    return next((kind for kind, hit in checks if hit), None)


@operation(
    "detect-invisible",
    "Detect Invisible Characters",
    "Security",
    "string",
    "table",
    examples=(
        Example(
            "a\u200bb\u2060c",
            {},
            (
                "index\tcp\tname\tkind\tline\tcolumn\n1\tU+200B\tZERO WIDTH "
                "SPACE\tzero-width\t1\t2\n3\tU+2060\tWORD JOINER\tzero-width\t1\t4"
            ),
        ),
    ),
)
def detect_invisible(text: str, _args: Args, ctx: OpContext) -> Table:
    """One row per invisible code point: bidi controls (Trojan Source, CVE-2021-42574),
    tag characters, variation selectors, zero-width characters, Hangul fillers and other
    default-ignorables. `index` is the 0-based code-point offset; `line` and `column` are
    1-based, lines are LF-separated and columns count code points."""
    rows: list[tuple[Cell, ...]] = []
    line, column = 1, 1
    for i, ch in enumerate(text):
        if i % 4096 == 0:
            ctx.check()
        cp = ord(ch)
        kind = invisible_kind(cp)
        if kind is not None:
            rows.append((i, f"U+{cp:04X}", names.preferred(cp), kind, line, column))
        if cp == _LF:
            line, column = line + 1, 1
        else:
            column += 1
    return Table(INVISIBLE_COLUMNS, tuple(rows))


@operation(
    "remove-bidi-controls",
    "Remove Bidi Controls",
    "Security",
    "string",
    "string",
    examples=(Example("abc\u202edef\u202c", {}, "abcdef"),),
)
def remove_bidi_controls(text: str, _args: Args, _ctx: OpContext) -> str:
    """Delete every Bidi_Control character (U+061C, U+200E, U+200F, U+202A..U+202E,
    U+2066..U+2069)."""
    return "".join(ch for ch in text if not props.has("Bidi_Control", ord(ch)))


def _hex(text: str) -> str:
    return " ".join(f"{ord(ch):04X}" for ch in text)


@operation(
    "detect-confusables",
    "Detect Confusables",
    "Security",
    "string",
    "table",
    (string_arg("reference", ""),),
    examples=(
        Example(
            "p\u0430ypal",
            {},
            "index\tcp\tname\tprototype\n1\tU+0430\tCYRILLIC SMALL LETTER A\tU+0061",
        ),
    ),
)
def detect_confusables(text: str, args: Args, ctx: OpContext) -> Table:
    """UTS #39 skeletons (NFD, confusables.txt, NFD). With a `reference`, one row compares
    both skeletons (code points as hex) and `confusable` is `true` when they are equal.
    Without one, one row per code point that has a confusables.txt prototype."""
    reference = args.text("reference")
    if reference:
        ctx.check()
        mine, theirs = confusables.skeleton(text), confusables.skeleton(reference)
        verdict = "true" if mine == theirs else "false"
        return Table(COMPARE_COLUMNS, ((_hex(mine), _hex(theirs), verdict),))
    rows: list[tuple[Cell, ...]] = []
    for i, ch in enumerate(text):
        if i % 4096 == 0:
            ctx.check()
        cp = ord(ch)
        target = confusables.prototype(cp)
        if target is not None:
            proto = " ".join(f"U+{p:04X}" for p in target)
            rows.append((i, f"U+{cp:04X}", names.preferred(cp), proto))
    return Table(CONFUSABLE_COLUMNS, tuple(rows))


def _resolved_without_latin(text: str) -> frozenset[str] | None:
    """Resolved script set of the characters whose Script_Extensions lack Latin."""
    resolved: frozenset[str] | None = None
    for ch in text:
        scripts = confusables.augmented_scripts(ord(ch))
        if scripts is None or "Latn" in scripts:
            continue
        resolved = scripts if resolved is None else resolved & scripts
    return resolved


def restriction_level(text: str, profile: bool = True) -> str:
    """UTS #39 §5.2 restriction level. With ``profile``, any character outside the
    General Security Profile (Identifier_Status Restricted) makes the text Unrestricted."""
    if profile and any(confusables.identifier_status(ord(ch)) != "Allowed" for ch in text):
        return "Unrestricted"
    if all(ord(ch) < _ASCII_END for ch in text):
        return "ASCII-Only"
    if confusables.resolved_script_set(text) != frozenset():
        return "Single Script"
    others = _resolved_without_latin(text)
    if others and others & _CJK_SETS:
        return "Highly Restrictive"
    if others and not others & {"Cyrl", "Grek"}:
        return "Moderately Restrictive"
    return "Minimally Restrictive"


@operation(
    "script-mix-check",
    "Script Mix Check",
    "Security",
    "string",
    "string",
    (bool_arg("profile", True),),
    examples=(
        Example("paypal", {}, "ASCII-Only"),
        Example("p\u0430ypal", {}, "Minimally Restrictive"),
    ),
)
def script_mix_check(text: str, args: Args, ctx: OpContext) -> str:
    """The UTS #39 restriction level of the whole input: ASCII-Only, Single Script,
    Highly Restrictive, Moderately Restrictive, Minimally Restrictive or Unrestricted.
    `profile` (default true) applies step 1, so characters that are not
    Identifier_Status=Allowed (including spaces and punctuation) give Unrestricted."""
    ctx.check()
    return restriction_level(text, args.flag("profile"))
