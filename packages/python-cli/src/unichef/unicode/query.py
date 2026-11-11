# SPDX-License-Identifier: GPL-3.0-or-later
"""The character query language (PRD §4.8).

    query      = or ;
    or         = and , { "|" , and } ;
    and        = unary , { "&" , unary } ;
    unary      = [ "!" ] , atom ;
    atom       = "(" , query , ")" | name_re | comparison ;
    name_re    = "name" , "~" , "/" , pattern , "/" , [ "i" ] ;
    comparison = prop , op , value | binary_prop ;

Evaluation narrows a candidate set from left to right, so ``gc=Lu & name~/LATIN/`` runs
the regex over uppercase letters only. Results are code points in ascending order.
"""

from dataclasses import dataclass
from typing import Literal, NoReturn

from unichef.core.errors import UniChefError
from unichef.regex import run
from unichef.unicode import data, names, props
from unichef.unicode.data import MAX_CODE_POINT, Ranges

DEFAULT_LIMIT = 10_000
ENUMERATED_PROPS = frozenset({"gc", "sc", "scx", "blk", "age", "bc", "ea", "ccc"})
ORDERED_PROPS = frozenset({"age", "ccc"})
_OPERATORS = ("<=", ">=", "!=", "=", "<", ">")
_SINGLE = frozenset("()|&!~")
_WORD_EXTRA = frozenset("_.-")
_YES = frozenset({"y", "yes", "t", "true"})
_NO = frozenset({"n", "no", "f", "false"})
_EVERYTHING: Ranges = [(0, MAX_CODE_POINT)]

type TokenKind = Literal["word", "quoted", "op", "punct", "regex", "end"]
type Op = Literal["=", "!=", "<", "<=", ">", ">="]


@dataclass(slots=True, frozen=True)
class QueryResult:
    code_points: tuple[int, ...]
    total: int
    truncated: bool


@dataclass(slots=True, frozen=True)
class _Token:
    kind: TokenKind
    text: str
    pos: int
    flags: str = ""


def _fail(message: str) -> NoReturn:
    raise UniChefError("E_ARG_INVALID", message)


def _read_regex(text: str, i: int) -> tuple[_Token, int]:
    """Read ``/body/flags`` starting at the slash at ``i``; a backslash-slash is a literal slash."""
    body: list[str] = []
    j = i + 1
    while j < len(text) and text[j] != "/":
        if text[j] == "\\" and text[j + 1 : j + 2] == "/":
            j += 1
        elif text[j] == "\\" and j + 1 < len(text):
            body.append(text[j])
            j += 1
        body.append(text[j])
        j += 1
    if j >= len(text):
        _fail(f"Missing closing '/' for the regex at offset {i}.")
    flags = ""
    while j + 1 < len(text) and text[j + 1].isalpha():
        flags += text[j + 1]
        j += 1
    if flags not in {"", "i"}:
        _fail(f"Name regexes take only the i flag, not {flags[:8]!r}.")
    return _Token("regex", "".join(body), i, flags), j + 1


def _read_quoted(text: str, i: int) -> tuple[_Token, int]:
    """Read a double-quoted string starting at ``i``; a backslash escapes any character."""
    j = i + 1
    chunk: list[str] = []
    while j < len(text) and text[j] != '"':
        if text[j] == "\\" and j + 1 < len(text):
            j += 1
        chunk.append(text[j])
        j += 1
    if j >= len(text):
        _fail(f"Missing closing quote for the string at offset {i}.")
    return _Token("quoted", "".join(chunk), i), j + 1


def _tokens(text: str) -> list[_Token]:
    out: list[_Token] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch.isspace():
            i += 1
            continue
        if ch == "/":
            token, i = _read_regex(text, i)
        elif ch == '"':
            token, i = _read_quoted(text, i)
        elif op := next((o for o in _OPERATORS if text.startswith(o, i)), None):
            token = _Token("op", op, i)
            i += len(op)
        elif ch in _SINGLE:
            token = _Token("punct", ch, i)
            i += 1
        elif ch.isalnum() or ch in _WORD_EXTRA:
            j = i
            while j < len(text) and (text[j].isalnum() or text[j] in _WORD_EXTRA):
                j += 1
            token = _Token("word", text[i:j], i)
            i = j
        else:
            _fail(f"Unexpected {ch!r} at offset {i} in the query.")
        out.append(token)
    out.append(_Token("end", "", len(text)))
    return out


class _Evaluator:
    """Recursive descent that evaluates as it parses, narrowing ``within`` as it goes."""

    __slots__ = ("pos", "timeout_ms", "tokens")

    def __init__(self, text: str, timeout_ms: int) -> None:
        self.tokens = _tokens(text)
        self.pos = 0
        self.timeout_ms = timeout_ms

    def _peek(self) -> _Token:
        return self.tokens[self.pos]

    def _next(self) -> _Token:
        token = self.tokens[self.pos]
        self.pos += 1
        return token

    def _expect(self, text: str) -> None:
        token = self._next()
        if token.text != text or token.kind not in {"punct", "op"}:
            _fail(f"Expected {text!r} at offset {token.pos} in the query.")

    def run(self) -> Ranges:
        result = self._or(_EVERYTHING)
        if self._peek().kind != "end":
            _fail(f"Unexpected {self._peek().text!r} at offset {self._peek().pos}.")
        return result

    def _or(self, within: Ranges) -> Ranges:
        result = self._and(within)
        while self._peek().text == "|" and self._peek().kind == "punct":
            self.pos += 1
            result = data.union(result, self._and(within))
        return result

    def _and(self, within: Ranges) -> Ranges:
        result = self._unary(within)
        while self._peek().text == "&" and self._peek().kind == "punct":
            self.pos += 1
            result = self._unary(result)
        return result

    def _unary(self, within: Ranges) -> Ranges:
        if self._peek().text == "!" and self._peek().kind == "punct":
            self.pos += 1
            return data.intersect(within, data.complement(self._atom(within)))
        return self._atom(within)

    def _atom(self, within: Ranges) -> Ranges:
        token = self._next()
        if token.kind == "punct" and token.text == "(":
            result = self._or(within)
            self._expect(")")
            return result
        if token.kind != "word":
            _fail(f"Expected a property or '(' at offset {token.pos} in the query.")
        if props.loose(token.text) == "name" and self._peek().text == "~":
            self.pos += 1
            pattern = self._next()
            if pattern.kind != "regex":
                _fail(f"Expected /regex/ after name~ at offset {pattern.pos}.")
            return self._name(pattern, within)
        nxt = self._peek()
        if nxt.kind != "op":
            return data.intersect(within, self._binary(token.text, "yes"))
        self.pos += 1
        value = self._next()
        if value.kind not in {"word", "quoted"}:
            _fail(f"Expected a value at offset {value.pos} in the query.")
        return data.intersect(within, self._compare(token.text, nxt.text, value.text))

    def _name(self, token: _Token, within: Ranges) -> Ranges:
        test = run.predicate(run.compile_regex(token.text, token.flags), self.timeout_ms)
        hits = {cp for cp, text in names.iter_names(within) if test(text)}
        hits.update(
            cp for cp, alias in names.iter_aliases(within) if cp not in hits and test(alias.alias)
        )
        return data.merge((cp, cp) for cp in hits)

    def _binary(self, name: str, value: str) -> Ranges:
        prop = props.resolve_property(name)
        if not props.is_binary(prop):
            _fail(f"{name} is not a binary property; compare it with a value, as in {name}=….")
        answer = props.loose(value)
        if answer not in _YES | _NO:
            _fail(f"Binary property {name} takes Yes or No, not {value[:32]!r}.")
        ranges = props.binary_ranges(prop)
        return ranges if answer in _YES else data.complement(ranges)

    def _compare(self, name: str, op: str, value: str) -> Ranges:
        prop = props.resolve_property(name)
        if props.is_binary(prop):
            if op not in {"=", "!="}:
                _fail(f"Binary property {name} takes only = and !=.")
            ranges = self._binary(name, value)
            return ranges if op == "=" else data.complement(ranges)
        if prop not in ENUMERATED_PROPS:
            _fail(f"The query language cannot search by {name}.")
        if op not in {"=", "!="}:
            if prop not in ORDERED_PROPS:
                _fail(f"Ordering comparisons work for age and ccc only, not {name}.")
            return self._ordered(prop, op, value)
        resolved = props.resolve_value("sc" if prop == "scx" else prop, value)
        ranges = props.ranges_for(prop, resolved)
        return ranges if op == "=" else data.complement(ranges)

    def _ordered(self, prop: str, op: str, value: str) -> Ranges:
        def key(text: str) -> tuple[int, ...]:
            return tuple(int(part) for part in text.split("."))

        resolved = props.resolve_value(prop, value)
        if prop == "age" and resolved == "NA":
            _fail("Unassigned (age NA) has no order.")
        target = key(resolved)
        table = props.table(prop)
        candidates = {table.default, *table.values} - {"NA"}
        tests = {
            "<": lambda k: k < target, "<=": lambda k: k <= target,
            ">": lambda k: k > target, ">=": lambda k: k >= target,
        }  # fmt: skip
        wanted = {v for v in candidates if tests[op](key(str(v)))}
        return table.ranges_where(wanted)


def query(text: str, limit: int = DEFAULT_LIMIT, timeout_ms: int = 2000) -> QueryResult:
    """Run a character query; at most ``limit`` code points, ascending."""
    if not text.strip():
        _fail("The query is empty.")
    ranges = _Evaluator(text, timeout_ms).run()
    total = sum(end - start + 1 for start, end in ranges)
    out: list[int] = []
    for start, end in ranges:
        out.extend(range(start, min(end, start + limit - len(out) - 1) + 1))
        if len(out) >= limit:
            break
    return QueryResult(tuple(out), total, total > limit)
