# SPDX-License-Identifier: GPL-3.0-or-later
"""Unicode operations (PRD §3.8 Alpha, §4.4-4.6; semantics in spec/README.md).

Every property, name, mapping and boundary comes from the pinned UCD artefacts through
``unichef.unicode``; the host's tables are never consulted.
"""

import re
from collections import Counter
from collections.abc import Callable

from unichef.core.dish import Cell, Table
from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    Example,
    OpContext,
    bool_arg,
    enum_arg,
    operation,
    string_arg,
)
from unichef.unicode import case, confusables, data, names, normalize, props, segment, utf8

_ASCII_END = 0x80
_SPACE = 0x20
_SUPPLEMENTARY = 0x10000
_MAX_CODE_POINT = 0x10FFFF
_HIGH = range(0xD800, 0xDC00)
_LOW = range(0xDC00, 0xE000)
_SURROGATES = range(0xD800, 0xE000)
_TAGS = range(0xE0000, 0xE0080)
_DOTTED_CIRCLE = "\u25cc"
_ZERO_WIDTH = frozenset({0x180E, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF})
_HIDDEN_GC = frozenset({"Cc", "Cf", "Cs", "Co", "Cn", "Zl", "Zp"})
_NONSPACING = frozenset({"Mn", "Me"})


def _bad(message: str) -> UniChefError:
    return UniChefError("E_DECODE", message)


def _utf16(cp: int) -> tuple[int, ...]:
    if cp < _SUPPLEMENTARY:
        return (cp,)
    v = cp - _SUPPLEMENTARY
    return 0xD800 | (v >> 10), 0xDC00 | (v & 0x3FF)


# ---------------------------------------------------------------------------
# escape-unicode / unescape-unicode

ESCAPE_FORMATS = (
    "backslash-u",  # \uXXXX, UTF-16 units
    "backslash-u-braces",  # \u{X}
    "backslash-big-u",  # \UXXXXXXXX
    "u-plus",  # U+XXXX
    "html-hex",  # &#xX;
    "html-decimal",  # &#D;
    "percent-u",  # %uXXXX, UTF-16 units
)

_ESCAPERS: dict[str, Callable[[int], str]] = {
    "backslash-u": lambda cp: "".join(f"\\u{u:04X}" for u in _utf16(cp)),
    "backslash-u-braces": lambda cp: f"\\u{{{cp:X}}}",
    "backslash-big-u": lambda cp: f"\\U{cp:08X}",
    "u-plus": lambda cp: f"U+{cp:04X}",
    "html-hex": lambda cp: f"&#x{cp:X};",
    "html-decimal": lambda cp: f"&#{cp};",
    "percent-u": lambda cp: "".join(f"%u{u:04X}" for u in _utf16(cp)),
}

# Alternatives in priority order: \u{…} must be tried before \uXXXX.
_UNESCAPE_PATTERNS = {
    "backslash-u-braces": r"\\u\{([0-9A-Fa-f]{1,6})\}",
    "backslash-u": r"\\u([0-9A-Fa-f]{4})",
    "backslash-big-u": r"\\U([0-9A-Fa-f]{8})",
    "u-plus": r"U\+([0-9A-Fa-f]{4,6})",
    "html-hex": r"&#[xX]([0-9A-Fa-f]{1,6});",
    "html-decimal": r"&#([0-9]{1,7});",
    "percent-u": r"%u([0-9A-Fa-f]{4})",
}
_UTF16_FORMATS = frozenset({"backslash-u", "percent-u"})


def _non_printable(cp: int) -> bool:
    gc = props.gc(cp)
    return (
        gc in props.GC_GROUPS["C"]
        or gc in {"Zl", "Zp"}
        or (gc == "Zs" and cp != _SPACE)
        or props.has("Default_Ignorable_Code_Point", cp)
    )


@operation(
    "escape-unicode",
    "Escape Unicode",
    "Unicode",
    "string",
    "string",
    (
        enum_arg("format", ESCAPE_FORMATS),
        enum_arg("scope", ("non-ascii", "all", "non-printable")),
    ),
    examples=(
        Example("café 👋", {}, "caf\\u00E9 \\uD83D\\uDC4B"),
        Example("café 👋", {"format": "html-hex"}, "caf&#xE9; &#x1F44B;"),
    ),
)
def escape_unicode(text: str, args: Args, ctx: OpContext) -> str:
    """Write characters as escapes with upper-case hex. `scope` picks every non-ASCII
    character, every character, or only non-printable ones (categories C, Zl, Zp, Zs
    other than U+0020, and default-ignorables). `backslash-u` and `percent-u` write
    astral characters as surrogate pairs."""
    ctx.check()
    escape = _ESCAPERS[args.text("format")]
    scope = args.text("scope")
    picked: Callable[[int], bool] = {
        "all": lambda _cp: True,
        "non-ascii": lambda cp: cp >= _ASCII_END,
        "non-printable": _non_printable,
    }[scope]
    return "".join(escape(ord(ch)) if picked(ord(ch)) else ch for ch in text)


@operation(
    "unescape-unicode",
    "Unescape Unicode",
    "Unicode",
    "string",
    "string",
    (enum_arg("format", ("all", *ESCAPE_FORMATS)),),
    examples=(Example("caf\\u00e9 \\U0001F44B", {}, "café 👋"),),
)
def unescape_unicode(text: str, args: Args, ctx: OpContext) -> str:
    """Replace escapes with characters; `all` recognises every format. Adjacent UTF-16
    escapes of one format combine into a pair; a lone surrogate becomes U+FFFD, and an
    escape above 10FFFF is left as it is."""
    ctx.check()
    chosen = args.text("format")
    formats = [f for f in _UNESCAPE_PATTERNS if chosen in {"all", f}]
    pattern = re.compile("|".join(f"(?:{_UNESCAPE_PATTERNS[f]})" for f in formats))
    out: list[str] = []
    done = 0
    pending: tuple[str, int, int] | None = None  # format, value, end of a high surrogate

    def flush() -> None:
        nonlocal pending
        if pending is not None:
            out.append(utf8.REPLACEMENT)
            pending = None

    for match in pattern.finditer(text):
        index = next(i for i, g in enumerate(match.groups()) if g is not None)
        fmt = formats[index]
        value = int(match.group(index + 1), 10 if fmt == "html-decimal" else 16)
        if pending is not None and (
            pending[0] != fmt or pending[2] != match.start() or value not in _LOW
        ):
            flush()
        out.append(text[done : match.start()])
        done = match.end()
        if value > _MAX_CODE_POINT:
            out.append(match.group())
        elif pending is not None:
            out.append(chr(_SUPPLEMENTARY + ((pending[1] - 0xD800) << 10) + (value - 0xDC00)))
            pending = None
        elif value in _HIGH and fmt in _UTF16_FORMATS:
            pending = (fmt, value, match.end())
        elif value in _SURROGATES:
            out.append(utf8.REPLACEMENT)
        else:
            out.append(chr(value))
    flush()
    out.append(text[done:])
    return "".join(out)


# ---------------------------------------------------------------------------
# normalize, case, strip-diacritics, grapheme-split


@operation(
    "normalize",
    "Normalize",
    "Unicode",
    "string",
    "string",
    (enum_arg("form", normalize.FORMS),),
    examples=(Example("ﬁ ① Ｘ²", {"form": "NFKC"}, "fi 1 X2"),),
)
def normalize_text(text: str, args: Args, ctx: OpContext) -> str:
    """Apply a Unicode normalization form (UAX #15) from the pinned UCD."""
    form = args.text("form")
    return normalize.normalize(form, text, ctx.check)  # type: ignore[arg-type]


@operation(
    "unicode-case",
    "Unicode Case",
    "Unicode",
    "string",
    "string",
    (
        enum_arg("mode", ("upper", "lower", "title", "fold")),
        enum_arg("locale", case.LOCALES),
        bool_arg("simple"),
    ),
    examples=(
        Example("straße", {"mode": "upper"}, "STRASSE"),
        Example("İstanbul", {"mode": "lower", "locale": "tr"}, "istanbul"),
    ),
)
def unicode_case(text: str, args: Args, ctx: OpContext) -> str:
    """Full case mapping with Final_Sigma and the `tr`, `az` and `lt` tailorings. `fold`
    is full case folding, or simple folding with `simple` (ignored by other modes)."""
    ctx.check()
    mode = args.text("mode")
    locale = args.text("locale")
    if mode == "fold":
        return case.fold(text, simple=args.flag("simple"), locale=locale)  # type: ignore[arg-type]
    convert = {"upper": case.upper, "lower": case.lower, "title": case.title}[mode]
    return convert(text, locale)  # type: ignore[arg-type]


def _is_diacritic_mark(cp: int) -> bool:
    return (
        props.gc(cp) == "Mn"
        and props.sc(cp) == confusables.INHERITED
        and props.has("Diacritic", cp)
    )


@operation(
    "strip-diacritics",
    "Strip Diacritics",
    "Unicode",
    "string",
    "string",
    examples=(Example("Crème brûlée", {}, "Creme brulee"),),
)
def strip_diacritics(text: str, _args: Args, ctx: OpContext) -> str:
    """NFD, then drop nonspacing marks that are Diacritic and of the Inherited script,
    then NFC. Script-specific marks such as the Devanagari virama are kept, and letters
    with no decomposition (ø, ł) are unchanged."""
    decomposed = normalize.normalize("NFD", text, ctx.check)
    kept = "".join(ch for ch in decomposed if not _is_diacritic_mark(ord(ch)))
    return normalize.normalize("NFC", kept, ctx.check)


@operation(
    "grapheme-split",
    "Grapheme Split",
    "Unicode",
    "string",
    "string",
    (string_arg("delimiter", "\n"),),
    examples=(Example("e\u0301👋\U0001f3fd🇮🇶", {"delimiter": " "}, "e\u0301 👋\U0001f3fd 🇮🇶"),),
)
def grapheme_split(text: str, args: Args, ctx: OpContext) -> str:
    """Join the extended grapheme clusters (UAX #29) with `delimiter`."""
    return args.text("delimiter").join(segment.graphemes(text, ctx.check))


# ---------------------------------------------------------------------------
# Code points and counting

CODE_POINT_FORMATS = {
    "u-plus": "U+{:04X}",
    "hex": "{:04X}",
    "0x": "0x{:04X}",
    "decimal": "{:d}",
}
CODE_POINT_DELIMITERS = {"space": " ", "comma": ",", "newline": "\n"}
_CODE_POINT_SEPARATORS = re.compile(r"[\t\n\v\f\r ,;]+")
_CODE_POINT_TOKEN = re.compile(r"(?:([Uu]\+|0[xX])([0-9A-Fa-f]{1,6})|([0-9A-Fa-f]{1,7}))")


@operation(
    "to-code-points",
    "To Code Points",
    "Unicode",
    "codepoints",
    "string",
    (
        enum_arg("format", tuple(CODE_POINT_FORMATS)),
        enum_arg("delimiter", tuple(CODE_POINT_DELIMITERS)),
    ),
    examples=(Example("Hi 👋", {}, "U+0048 U+0069 U+0020 U+1F44B"),),
)
def to_code_points(cps: list[int], args: Args, ctx: OpContext) -> str:
    """Write each code point as `U+0041`, `0041`, `0x0041` or `65`."""
    ctx.check()
    fmt = CODE_POINT_FORMATS[args.text("format")]
    return CODE_POINT_DELIMITERS[args.text("delimiter")].join(fmt.format(cp) for cp in cps)


@operation(
    "from-code-points",
    "From Code Points",
    "Unicode",
    "string",
    "codepoints",
    (enum_arg("base", ("hex", "decimal")),),
    examples=(
        Example("48 69 1F44B", {}, "U+0048 U+0069 U+1F44B"),
        Example("72 105 128075", {"base": "decimal"}, "U+0048 U+0069 U+1F44B"),
    ),
)
def from_code_points(text: str, args: Args, ctx: OpContext) -> list[int]:
    """Read code points separated by whitespace, commas or semicolons. A `U+` or `0x`
    prefix always means hex; bare numbers use `base`. Surrogates are kept as code points
    (they become U+FFFD if the dish is later used as text)."""
    ctx.check()
    base = 16 if args.text("base") == "hex" else 10
    out: list[int] = []
    for token in _CODE_POINT_SEPARATORS.split(text):
        if not token:
            continue
        match = _CODE_POINT_TOKEN.fullmatch(token)
        if match is None:
            raise _bad(f"{token[:16]!r} is not a code point.")
        prefixed = match.group(2)
        try:
            value = int(prefixed, 16) if prefixed else int(match.group(3), base)
        except ValueError:
            raise _bad(f"{token[:16]!r} is not a decimal code point.") from None
        if value > _MAX_CODE_POINT:
            raise _bad(f"{token[:16]!r} is above U+10FFFF.")
        out.append(value)
    return out


COUNT_UNITS = ("bytes", "utf16-units", "code-points", "graphemes", "lines")


@operation(
    "count",
    "Count",
    "Unicode",
    "bytes",
    "integer",
    (enum_arg("unit", COUNT_UNITS, "code-points"),),
    examples=(
        Example("e\u0301👋\U0001f3fd", {"unit": "graphemes"}, "2"),
        Example("e\u0301👋\U0001f3fd", {"unit": "code-points"}, "4"),
        Example("e\u0301👋\U0001f3fd", {"unit": "bytes"}, "11"),
    ),
)
def count(data: bytes, args: Args, ctx: OpContext) -> int:
    """Count bytes, or decode UTF-8 (U+FFFD for ill-formed input) and count UTF-16
    units, code points, grapheme clusters or lines (LF-separated; a final LF does not
    start a new line)."""
    unit = args.text("unit")
    if unit == "bytes":
        return len(data)
    text = utf8.decode(data, ctx.check)
    if unit == "utf16-units":
        return sum(2 if ord(ch) >= _SUPPLEMENTARY else 1 for ch in text)
    if unit == "code-points":
        return len(text)
    if unit == "graphemes":
        return len(segment.graphemes(text, ctx.check))
    return 0 if not text else text.count("\n") + (not text.endswith("\n"))


# ---------------------------------------------------------------------------
# analyse-characters (PRD §4.6)

ANALYSIS_COLUMNS = (
    "index", "cp", "char", "name", "gc", "block", "script", "scx", "age",
    "bidi", "ea", "utf8", "utf16", "decomposition", "flags",
)  # fmt: skip
FLAG_ORDER = (
    "bidi-control", "zero-width", "default-ignorable", "tag", "variation-selector",
    "private-use", "noncharacter", "surrogate", "unassigned", "confusable", "mixed-script",
)  # fmt: skip


def _display(cp: int, *, first: bool = True) -> str:
    gc = props.gc(cp)
    if (
        gc in _HIDDEN_GC
        or props.has("White_Space", cp)
        or props.has("Default_Ignorable_Code_Point", cp)
    ):
        return f"⟨{names.preferred(cp).strip('<>')}⟩"
    if first and gc in _NONSPACING:
        return _DOTTED_CIRCLE + chr(cp)
    return chr(cp)


def _foreign_scripts(text: str) -> Callable[[int], bool]:
    """Mark characters outside the most frequent script of a mixed-script text (UTS #39
    resolved script set empty). The majority counts Script values other than Common and
    Inherited; a tie goes to the smallest script code."""
    if confusables.resolved_script_set(text) != frozenset():
        return lambda _cp: False
    counts = Counter(
        sc
        for ch in text
        if (sc := props.sc(ord(ch))) not in {confusables.COMMON, confusables.INHERITED}
    )
    if not counts:  # only Common/Inherited characters with disjoint Script_Extensions
        return lambda _cp: False
    majority = min(counts, key=lambda s: (-counts[s], s))

    def foreign(cp: int) -> bool:
        scripts = confusables.augmented_scripts(cp)
        return scripts is not None and majority not in scripts

    return foreign


def _flags(cp: int, foreign: Callable[[int], bool]) -> list[str]:
    gc = props.gc(cp)
    noncharacter = props.has("Noncharacter_Code_Point", cp)
    found = {
        "bidi-control": props.has("Bidi_Control", cp),
        "zero-width": cp in _ZERO_WIDTH,
        "default-ignorable": props.has("Default_Ignorable_Code_Point", cp),
        "tag": cp in _TAGS,
        "variation-selector": props.has("Variation_Selector", cp),
        "private-use": gc == "Co",
        "noncharacter": noncharacter,
        "surrogate": gc == "Cs",
        "unassigned": gc == "Cn" and not noncharacter,
        "confusable": confusables.prototype(cp) is not None,
        "mixed-script": foreign(cp),
    }
    return [flag for flag in FLAG_ORDER if found[flag]]


def _columns(cp: int, foreign: Callable[[int], bool]) -> dict[str, str]:
    decomposition = normalize.decomposition(cp)
    decomp = ""
    if decomposition is not None:
        tag, parts = decomposition
        decomp = " ".join([*([tag] if tag else []), *(f"{p:04X}" for p in parts)])
    return {
        "cp": f"U+{cp:04X}",
        "name": names.preferred(cp),
        "gc": props.gc(cp),
        "block": props.block(cp),
        "script": props.sc(cp),
        "scx": " ".join(props.scx(cp)),
        "age": str(props.get("age", cp)),
        "bidi": str(props.get("bc", cp)),
        "ea": str(props.get("ea", cp)),
        "utf8": " ".join(f"{b:02X}" for b in utf8.encode(chr(cp))),
        "utf16": " ".join(f"{u:04X}" for u in _utf16(cp)),
        "decomposition": decomp,
        "flags": ",".join(_flags(cp, foreign)),
    }


@operation(
    "analyse-characters",
    "Analyse Characters",
    "Unicode",
    "string",
    "table",
    (enum_arg("granularity", ("codepoint", "grapheme")),),
    examples=(
        Example(
            "e\u0301👋\U0001f3fd",
            {},
            (
                "index\tcp\tchar\tname\tgc\tblock\tscript\tscx\tage\tbidi\tea\tutf8\tutf1"
                "6\tdecomposition\tflags\n0\tU+0065\te\tLATIN SMALL LETTER "
                "E\tLl\tBasic Latin\tLatn\tLatn\t1.1\tL\tNa\t65\t0065\t\t\n"
                "1\tU+0301\t◌\u0301\tCOMBINING ACUTE ACCENT\tMn\tCombining Diacritical "
                "Marks\tZinh\tCher Cyrl Grek Latn Osge Sunu Tale Todr\t1."
                "1\tNSM\tA\tCC 81\t0301\t\t\n2\tU+1F44B\t👋\tWAVING HAND "
                "SIGN\tSo\tMiscellaneous Symbols and Pictographs\tZyyy\tZyyy\t6."
                "0\tON\tW\tF0 9F 91 8B\tD83D DC4B\t\t\n3\tU+1F3FD\t\U0001f3fd\tEMOJI MODIFIER "
                "FITZPATRICK TYPE-4\tSk\tMiscellaneous Symbols and "
                "Pictographs\tZyyy\tZyyy\t8.0\tON\tW\tF0 9F 8F BD\tD83C DFFD\t\t"
            ),
        ),
    ),
)
def analyse_characters(text: str, args: Args, ctx: OpContext) -> Table:
    """One row per code point (or grapheme cluster) with the columns of PRD §4.6. In
    grapheme mode `index` is the inclusive code-point range `start-end`, per-code-point
    values are joined with ` + `, bytes and units with a space, and flags are merged."""
    foreign = _foreign_scripts(text)
    rows: list[tuple[Cell, ...]] = []
    if args.text("granularity") == "codepoint":
        for i, ch in enumerate(text):
            if i % 4096 == 0:
                ctx.check()
            cols = _columns(ord(ch), foreign)
            rows.append(
                (i, cols["cp"], _display(ord(ch)), *(cols[c] for c in ANALYSIS_COLUMNS[3:]))
            )
        return Table(ANALYSIS_COLUMNS, tuple(rows))
    start = 0
    for cluster in segment.graphemes(text, ctx.check):
        ctx.check()
        cps = [ord(ch) for ch in cluster]
        each = [_columns(cp, foreign) for cp in cps]
        merged: dict[str, Cell] = {
            "index": f"{start}-{start + len(cps) - 1}",
            "cp": " ".join(c["cp"] for c in each),
            "char": "".join(_display(cp, first=i == 0) for i, cp in enumerate(cps)),
        }
        for column in ANALYSIS_COLUMNS[3:]:
            values = [c[column] for c in each]
            if column in {"utf8", "utf16"}:
                merged[column] = " ".join(values)
            elif column == "flags":
                present = {f for v in values for f in v.split(",") if f}
                merged[column] = ",".join(f for f in FLAG_ORDER if f in present)
            else:  # keep one slot per code point, but leave an all-empty column empty
                merged[column] = " + ".join(values) if any(values) else ""
        rows.append(tuple(merged[c] for c in ANALYSIS_COLUMNS))
        start += len(cps)
    return Table(ANALYSIS_COLUMNS, tuple(rows))


# ---------------------------------------------------------------------------
# Beta: filter-by-property, show-bidi-classes, utf8-explain

_FILTER_PROPERTIES = {
    "general_category": "gc",
    "script": "sc",
    "script_extensions": "scx",
    "block": "blk",
}


def _filter_ranges(prop: str, spec: str) -> list[tuple[int, int]]:
    values = [v.strip() for v in spec.split(",")]
    if not any(values) or not all(values):
        raise UniChefError("E_ARG_INVALID", "value must list one or more property values.")
    lookup = "sc" if prop == "scx" else prop  # Script_Extensions takes Script values
    return data.union(*(props.ranges_for(prop, props.resolve_value(lookup, v)) for v in values))


@operation(
    "filter-by-property",
    "Filter by Property",
    "Unicode",
    "string",
    "string",
    (
        enum_arg("property", tuple(_FILTER_PROPERTIES)),
        string_arg("value", "L"),
        enum_arg("mode", ("keep", "remove")),
    ),
    examples=(
        Example("Zoë, 42 € 😀", {}, "Zoë"),
        Example(
            "Привет, world",
            {"property": "script", "value": "Cyrillic, Common", "mode": "keep"},
            "Привет, ",
        ),
    ),
)
def filter_by_property(text: str, args: Args, ctx: OpContext) -> str:
    """Keep or remove the code points whose property has one of the comma-separated
    `value`s. Names and aliases match loosely (`L`, `Letter`, `Latn`, `Basic Latin`);
    a General_Category group such as `L` covers its members."""
    ranges = _filter_ranges(_FILTER_PROPERTIES[args.text("property")], args.text("value"))
    keep = args.text("mode") == "keep"
    out: list[str] = []
    for i, ch in enumerate(text):
        if i % 4096 == 0:
            ctx.check()
        if data.contains(ranges, ord(ch)) == keep:
            out.append(ch)
    return "".join(out)


BIDI_COLUMNS = ("index", "cp", "char", "bidi", "bidi_name", "mirrored")


def _long_values(prop: str) -> dict[str, str]:
    """Stored value to its longest alias (the long name in PropertyValueAliases.txt)."""
    best: dict[str, str] = {}
    for alias, stored in data.load("core")["aliases"]["values"][prop].items():
        if len(alias) > len(best.get(stored, "")):
            best[stored] = alias
    return best


@operation(
    "show-bidi-classes",
    "Show Bidi Classes",
    "Unicode",
    "string",
    "table",
    examples=(
        Example(
            "a\u202eب(1",
            {},
            "index\tcp\tchar\tbidi\tbidi_name\tmirrored\n"
            "0\tU+0061\ta\tL\tLeft_To_Right\tfalse\n"
            "1\tU+202E\t⟨RIGHT-TO-LEFT OVERRIDE⟩\tRLO\tRight_To_Left_Override\tfalse\n"
            "2\tU+0628\tب\tAL\tArabic_Letter\tfalse\n"
            "3\tU+0028\t(\tON\tOther_Neutral\ttrue\n"
            "4\tU+0031\t1\tEN\tEuropean_Number\tfalse",
        ),
    ),
)
def show_bidi_classes(text: str, _args: Args, ctx: OpContext) -> Table:
    """One row per code point with its Bidi_Class (short and long name) and whether it is
    Bidi_Mirrored. Controls and invisible characters are shown by name."""
    long_names = _long_values("bc")
    rows: list[tuple[Cell, ...]] = []
    for i, ch in enumerate(text):
        if i % 4096 == 0:
            ctx.check()
        cp = ord(ch)
        bc = str(props.get("bc", cp))
        mirrored = props.has("Bidi_Mirrored", cp)
        rows.append((i, f"U+{cp:04X}", _display(cp), bc, long_names.get(bc, bc), mirrored))
    return Table(BIDI_COLUMNS, tuple(rows))


UTF8_COLUMNS = ("offset", "byte", "bits", "role", "cp", "char", "note")
_CONT = (0x80, 0xBF)
# Lead bytes (Unicode Table 3-7): sequence length and allowed second-byte range.
_LEADS: dict[int, tuple[int, tuple[int, int]]] = {
    **dict.fromkeys(range(0xC2, 0xE0), (2, _CONT)),
    0xE0: (3, (0xA0, 0xBF)),
    **dict.fromkeys(range(0xE1, 0xF0), (3, _CONT)),
    0xED: (3, (0x80, 0x9F)),
    0xF0: (4, (0x90, 0xBF)),
    **dict.fromkeys(range(0xF1, 0xF4), (4, _CONT)),
    0xF4: (4, (0x80, 0x8F)),
}
_SECOND_BYTE_NOTES = {
    0xE0: "overlong encoding",
    0xF0: "overlong encoding",
    0xED: "surrogate code point",
    0xF4: "above U+10FFFF",
}
_MAX_SEQUENCE = 4


def _is_cont(b: int) -> bool:
    return _CONT[0] <= b <= _CONT[1]


def _invalid_note(b: int) -> str:
    if _is_cont(b):
        return "unexpected continuation byte"
    if b in {0xC0, 0xC1}:
        return "overlong encoding"
    return "byte never used in UTF-8"


@operation(
    "utf8-explain",
    "UTF-8 Explain",
    "Unicode",
    "bytes",
    "table",
    examples=(
        Example(
            "é€",
            {},
            "offset\tbyte\tbits\trole\tcp\tchar\tnote\n"
            "0\tC3\t11000011\tlead of 2\tU+00E9\té\t\n"
            "1\tA9\t10101001\tcontinuation\t\t\t\n"
            "2\tE2\t11100010\tlead of 3\tU+20AC\t€\t\n"
            "3\t82\t10000010\tcontinuation\t\t\t\n"
            "4\tAC\t10101100\tcontinuation\t\t\t",
        ),
    ),
)
def utf8_explain(raw: bytes, _args: Args, ctx: OpContext) -> Table:
    """One row per byte: its bits, its role in the UTF-8 structure and, on the first byte
    of each sequence, the code point it encodes. Ill-formed input decodes to U+FFFD by
    maximal subparts, as everywhere else, and `note` says why."""
    rows: list[tuple[Cell, ...]] = []

    def row(i: int, role: str, cp: str = "", char: str = "", note: str = "") -> None:
        rows.append((i, f"{raw[i]:02X}", f"{raw[i]:08b}", role, cp, char, note))

    i, n = 0, len(raw)
    while i < n:
        if i % 4096 < _MAX_SEQUENCE:  # a sequence may step over a multiple of 4096
            ctx.check()
        b = raw[i]
        if b < _ASCII_END:
            row(i, "ASCII", f"U+{b:04X}", _display(b))
            i += 1
            continue
        lead = _LEADS.get(b)
        if lead is None:
            role = "continuation" if _is_cont(b) else "invalid"
            row(i, role, "U+FFFD", "\ufffd", _invalid_note(b))
            i += 1
            continue
        length, (low, high) = lead
        k = 1
        while k < length and i + k < n:
            lo, hi = (low, high) if k == 1 else _CONT
            if not lo <= raw[i + k] <= hi:
                break
            k += 1
        if k == length:
            code = ord(utf8.decode(raw[i : i + k]))
            row(i, f"lead of {length}", f"U+{code:04X}", _display(code))
        else:
            # A continuation byte outside the lead's second-byte range: see Table 3-7.
            special = k == 1 and i + 1 < n and _is_cont(raw[i + 1])
            note = _SECOND_BYTE_NOTES[b] if special else "incomplete sequence"
            row(i, f"lead of {length}", "U+FFFD", "\ufffd", note)
        for j in range(i + 1, i + k):
            row(j, "continuation")
        i += k
    return Table(UTF8_COLUMNS, tuple(rows))
