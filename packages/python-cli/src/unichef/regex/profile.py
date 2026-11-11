# SPDX-License-Identifier: GPL-3.0-or-later
"""The portable regex profile (PRD §4.9): parser, rejection of unsupported constructs, and
expansion of every character class to explicit code-point ranges from the pinned UCD.

The parser is hand-written recursive descent. It resolves flags while parsing, so the
tree it returns needs no further Unicode knowledge: ``.``, ``\\d``, ``\\w``, ``\\s``,
``\\p{…}`` and ``i``-flag case variants are already ``Chars`` range sets, and ``^ $ \\b \\B``
are ``Anchor`` nodes with fixed meanings. Line terminators are LF, CR, U+2028 and U+2029.

Malformed patterns raise ``E_ARG_INVALID``; well-formed constructs outside the profile
raise ``E_REGEX_UNSUPPORTED``.
"""

from dataclasses import dataclass
from functools import cache
from typing import Literal, NoReturn

from unichef.core.errors import UniChefError
from unichef.unicode import case, data, props
from unichef.unicode.data import MAX_CODE_POINT, Ranges

type Node = Chars | Seq | Alt | Group | Quant | Backref | Anchor
type GroupKind = Literal["capture", "group", "ahead", "not-ahead", "behind", "not-behind"]
type AnchorKind = Literal["start", "end", "line-start", "line-end", "word", "not-word"]

FLAGS = "imsx"
MAX_REPEAT = 65535
LINE_TERMINATORS: Ranges = [(0x0A, 0x0A), (0x0D, 0x0D), (0x2028, 0x2029)]
_HIGH_SURROGATES = (0xD800, 0xDBFF)
_LOW_SURROGATES = (0xDC00, 0xDFFF)
_SURROGATE_BITS = 10
_SUPPLEMENTARY = 0x10000
_SIMPLE_ESCAPES = {"n": 0x0A, "r": 0x0D, "t": 0x09, "f": 0x0C, "v": 0x0B}
_SET_OPERATORS = ("&&", "--", "||", "~~")
_YES = frozenset({"y", "yes", "t", "true"})
_NO = frozenset({"n", "no", "f", "false"})
_HEX_ESCAPE_DIGITS = {"x": 2, "u": 4}
_MAX_HEX_DIGITS = 6


@dataclass(slots=True, frozen=True)
class Chars:
    """One code point out of ``ranges`` (inclusive, sorted, coalesced)."""

    ranges: tuple[tuple[int, int], ...]


@dataclass(slots=True, frozen=True)
class Seq:
    items: tuple[Node, ...]


@dataclass(slots=True, frozen=True)
class Alt:
    branches: tuple[Node, ...]


@dataclass(slots=True, frozen=True)
class Group:
    kind: GroupKind
    body: Node
    name: str | None = None


@dataclass(slots=True, frozen=True)
class Quant:
    body: Node
    min: int
    max: int | None
    lazy: bool


@dataclass(slots=True, frozen=True)
class Backref:
    ref: int | str


@dataclass(slots=True, frozen=True)
class Anchor:
    kind: AnchorKind


@dataclass(slots=True, frozen=True)
class Pattern:
    root: Node
    flags: str
    groups: int
    names: tuple[str, ...]


# ---------------------------------------------------------------------------
# Character semantics


@cache
def digit() -> Ranges:
    """``\\d``: gc=Nd."""
    return props.ranges_for("gc", "Nd")


@cache
def word() -> Ranges:
    """``\\w``: Alphabetic | gc=M | gc=Nd | gc=Pc | Join_Control (UTS #18 Annex C)."""
    return data.union(
        props.binary_ranges("Alphabetic"),
        props.ranges_for("gc", "M"),
        props.ranges_for("gc", "Nd"),
        props.ranges_for("gc", "Pc"),
        props.binary_ranges("Join_Control"),
    )


@cache
def space() -> Ranges:
    """``\\s``: White_Space."""
    return props.binary_ranges("White_Space")


def close_case(ranges: Ranges) -> Ranges:
    """Add every code point with the same simple case fold as a member (flag ``i``)."""
    extra = [
        (other, other)
        for cp, orbit in case.simple_fold_orbits().items()
        if data.contains(ranges, cp)
        for other in orbit
    ]
    return data.union(ranges, extra) if extra else ranges


def property_ranges(body: str) -> Ranges:
    """The set named by the body of ``\\p{…}``: gc, sc, scx, blk or a binary property."""
    key, sep, value = body.partition("=")
    if not sep:
        try:
            return props.ranges_for("gc", props.resolve_value("gc", body))
        except UniChefError:
            pass
        prop = props.resolve_property(body)
        if not props.is_binary(prop):
            _invalid(f"\\p{{{body}}} needs a value, as in \\p{{{body}=…}}.")
        return props.binary_ranges(prop)
    prop = props.resolve_property(key)
    if props.is_binary(prop):
        answer = props.loose(value)
        if answer not in _YES | _NO:
            _invalid(f"Binary property {key} takes Yes or No, not {value!r}.")
        ranges = props.binary_ranges(prop)
        return ranges if answer in _YES else data.complement(ranges)
    if prop not in {"gc", "sc", "scx", "blk"}:
        _unsupported(f"\\p{{{key}=…}} is outside the portable profile (gc, sc, scx, blk).")
    resolved = props.resolve_value("sc" if prop == "scx" else prop, value)
    return props.ranges_for(prop, resolved)


def _invalid(message: str) -> NoReturn:
    raise UniChefError("E_ARG_INVALID", message)


def _unsupported(message: str) -> NoReturn:
    raise UniChefError("E_REGEX_UNSUPPORTED", message)


# ---------------------------------------------------------------------------
# Parser


class _Parser:
    __slots__ = ("backrefs", "flags", "groups", "names", "pos", "src")

    def __init__(self, src: str, flags: str) -> None:
        self.src = src
        self.flags = flags
        self.pos = 0
        self.groups = 0
        self.names: list[str] = []
        self.backrefs: list[int | str] = []

    # -- helpers

    def _peek(self, offset: int = 0) -> str:
        i = self.pos + offset
        return self.src[i] if i < len(self.src) else ""

    def _take(self) -> str:
        ch = self._peek()
        if not ch:
            _invalid("The pattern ends unexpectedly.")
        self.pos += 1
        return ch

    def _at(self) -> str:
        return f" at offset {self.pos}"

    def _skip_extended(self) -> None:
        if "x" not in self.flags:
            return
        while self.pos < len(self.src):
            ch = self.src[self.pos]
            if ch in " \t\n\r\f\v":
                self.pos += 1
            elif ch == "#":
                end = self.src.find("\n", self.pos)
                self.pos = len(self.src) if end < 0 else end + 1
            else:
                return

    def _chars(self, ranges: Ranges) -> Chars:
        if "i" in self.flags:
            ranges = close_case(ranges)
        return Chars(tuple(ranges))

    # -- grammar

    def parse(self) -> Pattern:
        root = self._alternation()
        if self.pos < len(self.src):
            _invalid(f"Unmatched ')'{self._at()}.")
        for ref in self.backrefs:
            if isinstance(ref, int) and ref > self.groups:
                _invalid(f"Backreference \\{ref} names a group that does not exist.")
            if isinstance(ref, str) and ref not in self.names:
                _invalid(f"Backreference \\k<{ref}> names a group that does not exist.")
        if self.backrefs and "i" in self.flags:
            _unsupported("Backreferences under the i flag are outside the portable profile.")
        return Pattern(root, self.flags, self.groups, tuple(self.names))

    def _alternation(self) -> Node:
        branches = [self._sequence()]
        while self._peek() == "|":
            self.pos += 1
            branches.append(self._sequence())
        return branches[0] if len(branches) == 1 else Alt(tuple(branches))

    def _sequence(self) -> Node:
        items: list[Node] = []
        while True:
            self._skip_extended()
            if self._peek() in {"", "|", ")"}:
                break
            atom = self._atom()
            self._skip_extended()
            items.append(self._quantified(atom))
        return items[0] if len(items) == 1 else Seq(tuple(items))

    def _atom(self) -> Node:  # noqa: PLR0911
        ch = self._take()
        match ch:
            case "(":
                return self._group()
            case "[":
                return self._class()
            case ".":
                dot = (
                    [(0, MAX_CODE_POINT)]
                    if "s" in self.flags
                    else data.complement(LINE_TERMINATORS)
                )
                return Chars(tuple(dot))
            case "^":
                return Anchor("line-start" if "m" in self.flags else "start")
            case "$":
                return Anchor("line-end" if "m" in self.flags else "end")
            case "\\":
                return self._escape_atom()
            case "*" | "+" | "?":
                _invalid(f"Nothing to repeat before {ch!r}{self._at()}.")
            case "{" | "}" | "]":
                _invalid(f"Escape the literal {ch!r}{self._at()} as \\{ch}.")
            case _:
                return self._chars([(ord(ch), ord(ch))])

    def _quantified(self, atom: Node) -> Node:
        ch = self._peek()
        if ch in {"*", "+", "?"}:
            self.pos += 1
            low, high = {"*": (0, None), "+": (1, None), "?": (0, 1)}[ch]
        elif ch == "{":
            low, high = self._braces()
        else:
            return atom
        if isinstance(atom, Anchor) or (
            isinstance(atom, Group) and atom.kind not in {"capture", "group"}
        ):
            _invalid(f"Anchors and lookarounds cannot be repeated{self._at()}.")
        lazy = self._peek() == "?"
        if lazy:
            self.pos += 1
        elif self._peek() == "+":
            _unsupported("Possessive quantifiers are outside the portable profile.")
        return Quant(atom, low, high, lazy)

    def _braces(self) -> tuple[int, int | None]:
        end = self.src.find("}", self.pos)
        body = self.src[self.pos + 1 : end] if end > 0 else ""
        low_text, comma, high_text = body.partition(",")
        if not (low_text.isascii() and low_text.isdigit()) or not (
            high_text == "" or (high_text.isascii() and high_text.isdigit())
        ):
            _invalid(f"Escape the literal '{{'{self._at()} as \\{{.")
        self.pos = end + 1
        low = int(low_text)
        high = (None if high_text == "" else int(high_text)) if comma else low
        if max(low, high or 0) > MAX_REPEAT:
            _invalid(f"Repeat counts are limited to {MAX_REPEAT}.")
        if high is not None and high < low:
            _invalid(f"The quantifier {{{body}}} has min > max.")
        return low, high

    def _group(self) -> Node:
        kind: GroupKind = "capture"
        name: str | None = None
        if self._peek() == "?":
            self.pos += 1
            kind, name = self._group_head()
        if kind == "capture":
            self.groups += 1
        body = self._alternation()
        if self._peek() != ")":
            _invalid("Missing ')' at the end of the pattern.")
        self.pos += 1
        return Group(kind, body, name)

    def _group_head(self) -> tuple[GroupKind, str | None]:
        heads: list[tuple[str, GroupKind]] = [
            (":", "group"), ("=", "ahead"), ("!", "not-ahead"),
            ("<=", "behind"), ("<!", "not-behind"),
        ]  # fmt: skip
        for prefix, kind in heads:
            if self.src.startswith(prefix, self.pos):
                self.pos += len(prefix)
                return kind, None
        if self._peek() == "<":
            self.pos += 1
            name = self._name(">")
            if name in self.names:
                _invalid(f"The group name {name!r} is used twice.")
            self.names.append(name)
            return "capture", name
        construct = {
            ">": "Atomic groups",
            "(": "Conditionals",
            "P": "Python-style (?P…) groups",
            "|": "Branch-reset groups",
            "#": "Inline comments",
        }.get(self._peek())
        if construct is None and (self._peek().isdigit() or self._peek() in {"R", "&", "+"}):
            construct = "Recursion"
        _unsupported(f"{construct or 'Inline flags'} are outside the portable profile.")

    def _name(self, close: str) -> str:
        end = self.src.find(close, self.pos)
        name = self.src[self.pos : end] if end >= 0 else ""
        if not (name.isascii() and name.isidentifier()):
            _invalid(f"Invalid group name{self._at()}.")
        self.pos = end + 1
        return name

    def _class(self) -> Node:
        negated = self._peek() == "^"
        if negated:
            self.pos += 1
        parts: list[tuple[int, int]] = []
        while True:
            ch = self._peek()
            if not ch:
                _invalid("Missing ']' at the end of the pattern.")
            if ch == "]":
                self.pos += 1
                break
            if self.src[self.pos : self.pos + 2] in _SET_OPERATORS:
                _unsupported("Class set operations are outside the portable profile.")
            if ch == "[":
                what = "POSIX classes" if self._peek(1) == ":" else "Nested classes"
                _unsupported(f"{what} are outside the portable profile.")
            start = self._class_atom()
            if self.src[self.pos : self.pos + 2] in _SET_OPERATORS:  # e.g. [a--b]
                _unsupported("Class set operations are outside the portable profile.")
            if self._peek() == "-" and self._peek(1) not in {"]", ""}:
                self.pos += 1
                end = self._class_atom()
                if (
                    len(start) != 1
                    or len(end) != 1
                    or start[0][0] != start[0][1]
                    or (end[0][0] != end[0][1])
                ):
                    _invalid(f"A class range needs single characters{self._at()}.")
                if end[0][0] < start[0][0]:
                    _invalid(f"The class range ends before it starts{self._at()}.")
                parts.append((start[0][0], end[0][0]))
            else:
                parts.extend(start)
        ranges = data.merge(parts)
        if "i" in self.flags:
            ranges = close_case(ranges)
        return Chars(tuple(data.complement(ranges) if negated else ranges))

    def _class_atom(self) -> Ranges:
        ch = self._take()
        if ch != "\\":
            return [(ord(ch), ord(ch))]
        ch = self._take()
        if ch == "b":
            return [(0x08, 0x08)]
        if ch.isdigit() and ch != "0":
            _invalid(f"Backreferences cannot appear in a class{self._at()}.")
        return self._escape_set(ch)

    def _escape_atom(self) -> Node:
        ch = self._take()
        if ch in {"b", "B"}:
            return Anchor("word" if ch == "b" else "not-word")
        if ch.isascii() and ch.isdigit() and ch != "0":
            digits = ch
            while self._peek().isascii() and self._peek().isdigit():
                digits += self._take()
            self.backrefs.append(int(digits))
            return Backref(int(digits))
        if ch == "k":
            if self._take() != "<":
                _invalid(f"\\k needs a group name in <…>{self._at()}.")
            name = self._name(">")
            self.backrefs.append(name)
            return Backref(name)
        return self._chars(self._escape_set(ch))

    def _escape_set(self, ch: str) -> Ranges:
        """The set for an escape that denotes characters (shared by classes and atoms)."""
        match ch:
            case "d" | "D":
                ranges = digit()
            case "w" | "W":
                ranges = word()
            case "s" | "S":
                ranges = space()
            case "p" | "P":
                ranges = self._property()
            case "0":
                if self._peek().isdigit():
                    _unsupported("Octal escapes are outside the portable profile.")
                return [(0, 0)]
            case "x" | "u":
                cp = self._hex(ch)
                return [(cp, cp)]
            case _ if ch in _SIMPLE_ESCAPES:
                return [(_SIMPLE_ESCAPES[ch], _SIMPLE_ESCAPES[ch])]
            case _ if ch.isascii() and ch.isalnum():
                _unsupported(f"The escape \\{ch} is outside the portable profile.")
            case _:
                return [(ord(ch), ord(ch))]
        return data.complement(ranges) if ch.isupper() else ranges

    def _property(self) -> Ranges:
        if self._take() != "{":
            _invalid(f"\\p needs a property in {{…}}{self._at()}.")
        end = self.src.find("}", self.pos)
        if end < 0:
            _invalid("Missing '}' after \\p{.")
        body = self.src[self.pos : end]
        self.pos = end + 1
        return property_ranges(body)

    def _hex(self, kind: str) -> int:
        if self._peek() == "{":
            end = self.src.find("}", self.pos)
            digits = self.src[self.pos + 1 : end] if end > 0 else ""
            if not 1 <= len(digits) <= _MAX_HEX_DIGITS:
                _invalid(f"Invalid \\{kind}{{…}} escape{self._at()}.")
            self.pos = end + 1
        else:
            width = _HEX_ESCAPE_DIGITS[kind]
            digits = self.src[self.pos : self.pos + width]
            if len(digits) != width:
                _invalid(f"\\{kind} needs {width} hex digits{self._at()}.")
            self.pos += width
        try:
            cp = int(digits, 16)
        except ValueError:
            _invalid(f"Invalid hex digits {digits!r} in \\{kind}.")
        if cp > MAX_CODE_POINT or not digits.isascii():
            _invalid(f"\\{kind}{{{digits}}} is beyond U+10FFFF.")
        if _HIGH_SURROGATES[0] <= cp <= _HIGH_SURROGATES[1] and self.src.startswith(
            "\\u", self.pos
        ):
            low_text = self.src[self.pos + 2 : self.pos + 6]
            try:
                low = int(low_text, 16)
            except ValueError:
                return cp
            if _LOW_SURROGATES[0] <= low <= _LOW_SURROGATES[1] and low_text.isascii():
                self.pos += 6
                return _SUPPLEMENTARY + (
                    ((cp - _HIGH_SURROGATES[0]) << _SURROGATE_BITS) | (low - _LOW_SURROGATES[0])
                )
        return cp


def parse(pattern: str, flags: str = "") -> Pattern:
    """Parse ``pattern`` under ``flags`` (any of ``imsx``) into an expanded tree."""
    if any(f not in FLAGS for f in flags) or len(set(flags)) != len(flags):
        _invalid(f"Regex flags must be distinct letters from {FLAGS!r}, not {flags[:16]!r}.")
    return _Parser(pattern, "".join(sorted(flags))).parse()
