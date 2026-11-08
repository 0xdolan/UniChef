# SPDX-License-Identifier: GPL-3.0-or-later
"""Punycode (RFC 3492) and UTS #46 IDNA processing, nontransitional (PRD §3.8).

Errors are collected as (label number, reason) pairs in a fixed order, so both cores
report the same first error: labels in order, each stopping at its first failed check,
then the bidi rule over all labels, then the DNS lengths (ToASCII only).
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import cache

from unichef.core.errors import UniChefError
from unichef.unicode import data, props
from unichef.unicode.normalize import normalize

# --- Punycode (RFC 3492 §5) ----------------------------------------------------------

BASE, TMIN, TMAX, SKEW, DAMP = 36, 1, 26, 38, 700
INITIAL_BIAS, INITIAL_N = 72, 0x80
MAXINT = 0x7FFFFFFF  # the RFC's overflow bound, as in most implementations
DELIMITER = "-"
DIGITS = "abcdefghijklmnopqrstuvwxyz0123456789"
SEPARATORS = (".", "\u3002", "\uff0e", "\uff61")  # domain-mode label separators
ACE_PREFIX = "xn--"
MAX_CP = 0x10FFFF
SURROGATES = range(0xD800, 0xE000)
CHECK_EVERY = 4096


class PunycodeError(ValueError):
    """Input that RFC 3492 cannot encode or decode."""


def _adapt(delta: int, points: int, first: bool) -> int:
    delta = delta // DAMP if first else delta // 2
    delta += delta // points
    k = 0
    while delta > ((BASE - TMIN) * TMAX) // 2:
        delta //= BASE - TMIN
        k += BASE
    return k + (BASE - TMIN + 1) * delta // (delta + SKEW)


def _threshold(k: int, bias: int) -> int:
    return TMIN if k <= bias else TMAX if k >= bias + TMAX else k - bias


def _digit(d: int) -> str:
    return DIGITS[d]


def _digit_value(ch: str) -> int:
    """0-35, or BASE for a character that is not a digit (letters in either case)."""
    value = DIGITS.find(ch.lower()) if ch.isascii() else -1
    return BASE if value < 0 else value


def punycode_encode(text: str, check: Callable[[], None] | None = None) -> str:
    """Encode ``text`` (any code points) to a Punycode string with lowercase digits."""
    cps = [ord(ch) for ch in text]
    out = [chr(cp) for cp in cps if cp < INITIAL_N]
    basic = handled = len(out)
    if basic:
        out.append(DELIMITER)
    n, delta, bias = INITIAL_N, 0, INITIAL_BIAS
    while handled < len(cps):
        if check is not None and handled % CHECK_EVERY == 0:
            check()
        m = min(cp for cp in cps if cp >= n)
        if m - n > (MAXINT - delta) // (handled + 1):
            raise PunycodeError("The input is too long to encode.")
        delta += (m - n) * (handled + 1)
        n = m
        for cp in cps:
            if cp < n:
                delta += 1
                if delta > MAXINT:
                    raise PunycodeError("The input is too long to encode.")
            elif cp == n:
                q, k = delta, BASE
                while True:
                    t = _threshold(k, bias)
                    if q < t:
                        break
                    out.append(_digit(t + (q - t) % (BASE - t)))
                    q = (q - t) // (BASE - t)
                    k += BASE
                out.append(_digit(q))
                bias = _adapt(delta, handled + 1, handled == basic)
                delta = 0
                handled += 1
        delta += 1
        n += 1
    return "".join(out)


def punycode_decode(text: str, check: Callable[[], None] | None = None) -> str:
    """Decode a Punycode string. Digits are case-insensitive; basic code points keep case."""
    b = max(text.rfind(DELIMITER), 0)
    out = [ord(ch) for ch in text[:b]]
    if any(cp >= INITIAL_N for cp in out):
        raise PunycodeError("A character before the last hyphen is not ASCII.")
    n, i, bias = INITIAL_N, 0, INITIAL_BIAS
    pos = b + 1 if b > 0 else 0
    while pos < len(text):
        if check is not None and len(out) % CHECK_EVERY == 0:
            check()
        old_i, w, k = i, 1, BASE
        while True:
            if pos >= len(text):
                raise PunycodeError("The input ends in the middle of a number.")
            digit = _digit_value(text[pos])
            pos += 1
            if digit >= BASE:
                raise PunycodeError(f"U+{ord(text[pos - 1]):04X} is not a Punycode digit.")
            if digit > (MAXINT - i) // w:
                raise PunycodeError("A number is too large.")
            i += digit * w
            t = _threshold(k, bias)
            if digit < t:
                break
            if w > MAXINT // (BASE - t):
                raise PunycodeError("A number is too large.")
            w *= BASE - t
            k += BASE
        size = len(out) + 1
        bias = _adapt(i - old_i, size, old_i == 0)
        if i // size > MAXINT - n:
            raise PunycodeError("A number is too large.")
        n += i // size
        i %= size
        if n > MAX_CP or n in SURROGATES:
            raise PunycodeError(f"The result would include U+{n:04X}, not a scalar value.")
        out.insert(i, n)
        i += 1
    return "".join(map(chr, out))


def _labels(domain: str) -> list[str]:
    for sep in SEPARATORS[1:]:
        domain = domain.replace(sep, ".")
    return domain.split(".")


def domain_to_punycode(domain: str, check: Callable[[], None] | None = None) -> str:
    """Encode each label that has a non-ASCII character as ``xn--`` plus Punycode."""
    return ".".join(
        ACE_PREFIX + punycode_encode(label, check) if not label.isascii() else label
        for label in _labels(domain)
    )


def domain_from_punycode(domain: str, check: Callable[[], None] | None = None) -> str:
    """Decode each label that starts with ``xn--`` (any case)."""
    return ".".join(
        punycode_decode(label[4:], check) if label[:4].lower() == ACE_PREFIX else label
        for label in _labels(domain)
    )


# --- UTS #46 ------------------------------------------------------------------------

VALID, IGNORED, DISALLOWED = "V", "I", "X"
FULL_STOP, HYPHEN = ".", "-"
ZWNJ, ZWJ = 0x200C, 0x200D
VIRAMA = 9
MAX_DOMAIN, MAX_LABEL = 253, 63
RTL = frozenset({"R", "AL", "AN"})
RTL_ALLOWED = frozenset({"R", "AL", "AN", "EN", "ES", "CS", "ET", "ON", "BN", "NSM"})
LTR_ALLOWED = frozenset({"L", "EN", "ES", "CS", "ET", "ON", "BN", "NSM"})
STD3 = frozenset("abcdefghijklmnopqrstuvwxyz0123456789-")


@dataclass(frozen=True)
class Flags:
    check_hyphens: bool = True
    check_bidi: bool = True
    check_joiners: bool = True
    use_std3_ascii_rules: bool = True


@cache
def _mapping() -> tuple[data.RangeTable, tuple[str | tuple[int, ...], ...]]:
    raw = data.load("security")["idna"]
    values = tuple(v if isinstance(v, str) else tuple(v) for v in raw["values"])
    table = data.RangeTable(
        {"default": -1, "values": list(range(len(values))), "ranges": raw["ranges"]}
    )
    return table, values


def status(cp: int) -> str | tuple[int, ...]:
    """``V``, ``I``, ``X`` or the mapping, for nontransitional processing."""
    table, values = _mapping()
    index = int(table.get(cp))
    return DISALLOWED if index < 0 else values[index]


@cache
def _joining() -> data.RangeTable:
    return data.RangeTable(data.load("security")["joiningType"])


def _jt(cp: int) -> str:
    return str(_joining().get(cp))


def _map(domain: str) -> str:
    out: list[str] = []
    for ch in domain:
        st = status(ord(ch))
        if st == IGNORED:
            continue
        out.append(ch if isinstance(st, str) else "".join(map(chr, st)))
    return "".join(out)


def _contextj_fails(label: str) -> int | None:
    """RFC 5892 Appendix A.1-A.2: the first ZWNJ or ZWJ not allowed where it is."""
    cps = [ord(ch) for ch in label]
    for i, cp in enumerate(cps):
        if cp not in (ZWNJ, ZWJ):
            continue
        if i > 0 and props.ccc(cps[i - 1]) == VIRAMA:
            continue
        if cp == ZWJ:
            return cp
        j = i - 1
        while j >= 0 and _jt(cps[j]) == "T":
            j -= 1
        k = i + 1
        while k < len(cps) and _jt(cps[k]) == "T":
            k += 1
        if not (j >= 0 and _jt(cps[j]) in "LD" and k < len(cps) and _jt(cps[k]) in "RD"):
            return cp
    return None


def _validity(label: str, flags: Flags, decoded: bool) -> str | None:  # noqa: PLR0911
    """UTS #46 §4.1 steps 1-8 (bidi is checked later): the first failure, or None."""
    if decoded and normalize("NFC", label) != label:
        return "it is not in NFC"
    if flags.check_hyphens:
        if label[2:4] == "--":
            return "it has hyphens in the third and fourth positions"
        if label.startswith(HYPHEN) or label.endswith(HYPHEN):
            return "it starts or ends with a hyphen"
    elif label.startswith(ACE_PREFIX):
        return "it starts with xn--"
    if FULL_STOP in label:
        return "it contains a full stop"
    if label and props.gc(ord(label[0])).startswith("M"):
        return "it starts with a combining mark"
    for ch in label:
        cp = ord(ch)
        if status(cp) != VALID:
            return f"U+{cp:04X} is not allowed"
        if flags.use_std3_ascii_rules and cp < INITIAL_N and ch not in STD3:
            return f"U+{cp:04X} is not a lowercase letter, digit or hyphen"
    if flags.check_joiners:
        bad = _contextj_fails(label)
        if bad is not None:
            return f"U+{bad:04X} is not allowed in this context"
    return None


def _bidi_fails(label: str) -> bool:
    """RFC 5893 §2 rules 1-6 for a non-empty label."""
    classes = [str(props.get("bc", ord(ch))) for ch in label]
    if classes[0] not in ("L", "R", "AL"):
        return True
    end = len(classes)
    while end > 0 and classes[end - 1] == "NSM":
        end -= 1
    last = classes[end - 1]
    if classes[0] == "L":
        return any(c not in LTR_ALLOWED for c in classes) or last not in ("L", "EN")
    return (
        any(c not in RTL_ALLOWED for c in classes)
        or last not in ("R", "AL", "EN", "AN")
        or ("EN" in classes and "AN" in classes)
    )


def process(domain: str, flags: Flags) -> tuple[list[str], list[tuple[int, str]]]:
    """UTS #46 §4 Processing: the converted labels and the errors found."""
    labels = normalize("NFC", _map(domain)).split(FULL_STOP)
    errors: list[tuple[int, str]] = []
    for number, label in enumerate(labels, 1):
        decoded = label.startswith(ACE_PREFIX)
        if decoded:
            if not label.isascii():
                errors.append((number, "a Punycode label has a non-ASCII character"))
                continue
            try:
                converted = punycode_decode(label[4:])
            except PunycodeError:
                errors.append((number, "it is not valid Punycode"))
                continue
            labels[number - 1] = converted
            if converted.isascii():
                errors.append((number, "a Punycode label decodes to ASCII only"))
                continue
        reason = _validity(labels[number - 1], flags, decoded)
        if reason is not None:
            errors.append((number, reason))
    if flags.check_bidi:  # X4_2: an empty label other than a final root label
        errors += [
            (number, "it is empty")
            for number, label in enumerate(labels, 1)
            if not label and (number < len(labels) or number == 1)
        ]
    if flags.check_bidi and any(props.get("bc", ord(ch)) in RTL for ch in "".join(labels)):
        errors += [
            (number, "it breaks the bidi rule")
            for number, label in enumerate(labels, 1)
            if label and _bidi_fails(label)  # empty labels are X4_2 or the root
        ]
    return labels, errors


def _fail(errors: list[tuple[int, str]]) -> UniChefError:
    number, reason = errors[0]
    more = f" ({len(errors) - 1} more)" if len(errors) > 1 else ""
    where = "the domain name" if number == 0 else f"label {number}"
    return UniChefError("E_DECODE", f"Not a valid domain name (UTS #46): {where}: {reason}.{more}")


def to_unicode(domain: str, flags: Flags) -> str:
    labels, errors = process(domain, flags)
    if errors:
        raise _fail(errors)
    return FULL_STOP.join(labels)


def to_ascii(
    domain: str,
    flags: Flags,
    verify_dns_length: bool,
    check: Callable[[], None] | None = None,
) -> str:
    labels, errors = process(domain, flags)
    for number, label in enumerate(labels, 1):
        if not label.isascii():
            try:
                labels[number - 1] = ACE_PREFIX + punycode_encode(label, check)
            except PunycodeError:
                errors.append((number, "it cannot be encoded as Punycode"))
    if verify_dns_length:
        names = labels[:-1] if len(labels) > 1 and labels[-1] == "" else labels
        total = len(FULL_STOP.join(names))
        if not 1 <= total <= MAX_DOMAIN:
            errors.append((0, f"its length is {total}, not 1 to {MAX_DOMAIN}"))
        errors += [
            (number, f"its length is {len(label)}, not 1 to {MAX_LABEL}")
            for number, label in enumerate(labels, 1)
            if not 1 <= len(label) <= MAX_LABEL
        ]
    if errors:
        raise _fail(errors)
    return FULL_STOP.join(labels)
