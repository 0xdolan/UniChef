# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Compile the pinned UCD files into the three UniChef data artefacts (PRD §4.1.3).

Reads only data/ucd/<version>/ (run scripts/ucd/fetch.py first) and writes
ucd-core-, ucd-names- and ucd-security-<version>.json.gz, byte-identically, to every
directory in OUT_DIRS. The output is deterministic: sorted keys, compact separators,
gzip level 9 with mtime 0. The format is described in data/ucd/README.md.

    uv run scripts/ucd/build.py            # build and write the artefacts
    uv run scripts/ucd/build.py --check    # rebuild in memory, fail on any drift
    uv run scripts/ucd/build.py --diff-from 16.0.0   # report what changed since then
"""

import argparse
import gzip
import json
import re
import sys
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "ucd"
OUT_DIRS = (
    ROOT / "packages" / "python-cli" / "src" / "unichef" / "_data",
    ROOT / "packages" / "npm-core" / "data",
)
BUDGETS = {"core": 400 * 1024, "names": 900 * 1024, "security": 150 * 1024}  # NFR-010, gzip
N_CP = 0x110000

Ranges = list[tuple[int, int, list[str]]]  # (first, last, fields)


class BuildError(Exception):
    pass


def check(cond: bool, msg: str) -> None:
    if not cond:
        raise BuildError(msg)


# --- Parsing ------------------------------------------------------------------------


def cp_range(field: str) -> tuple[int, int]:
    lo, _, hi = field.partition("..")
    return int(lo, 16), int(hi or lo, 16)


def read(folder: Path, rel: str) -> str:
    path = folder / rel
    check(path.exists(), f"{path} is missing; run scripts/ucd/fetch.py first.")
    return path.read_text(encoding="utf-8-sig")


def records(text: str) -> Iterator[tuple[int, int, list[str]]]:
    """Yield (first, last, fields) for each data line of a UCD file."""
    for line in text.splitlines():
        data = line.split("#", 1)[0].strip()
        if not data:
            continue
        fields = [f.strip() for f in data.split(";")]
        while fields and fields[-1] == "":
            fields.pop()
        lo, hi = cp_range(fields[0])
        yield lo, hi, fields[1:]


def missing(text: str) -> Iterator[tuple[int, int, list[str]]]:
    """Yield the '# @missing:' default-value lines, in file order."""
    for line in text.splitlines():
        if line.startswith("# @missing:"):
            fields = [f.strip() for f in line.removeprefix("# @missing:").split(";")]
            lo, hi = cp_range(fields[0])
            yield lo, hi, fields[1:]


def unicode_data(text: str) -> Iterator[tuple[int, int, list[str]]]:
    """Yield UnicodeData.txt rows, folding <..., First>/<..., Last> pairs into one range."""
    pending: tuple[int, list[str]] | None = None
    for line in text.splitlines():
        if not line:
            continue
        fields = line.split(";")
        cp = int(fields[0], 16)
        if fields[1].endswith(", First>"):
            pending = (cp, fields)
            continue
        if fields[1].endswith(", Last>"):
            check(pending is not None, f"Unpaired range end at {fields[0]}.")
            assert pending is not None
            yield pending[0], cp, pending[1][1:]
            pending = None
            continue
        yield cp, cp, fields[1:]


def loose(name: str) -> str:
    """UAX44-LM3 loose key: ignore case, whitespace, underscores and hyphens."""
    return re.sub(r"[\s_-]", "", name).lower()


def cps(field: str) -> list[int]:
    return [int(h, 16) for h in field.split()]


# --- Range encodings ----------------------------------------------------------------


def runs(values: list[Any], default: Any) -> Iterator[tuple[int, int, Any]]:
    """Yield (start, length, value) for maximal runs of non-default values."""
    start, prev = 0, values[0]
    for cp in range(1, N_CP + 1):
        cur = values[cp] if cp < N_CP else object()
        if cur != prev:
            if prev != default:
                yield start, cp - start, prev
            start, prev = cp, cur


def enum_table(values: list[Any], default: Any) -> dict[str, Any]:
    present = sorted({v for v in values if v != default}, key=lambda v: (str(type(v)), v))
    index = {v: i for i, v in enumerate(present)}
    flat: list[int] = []
    for start, length, value in runs(values, default):
        flat += [start, length, index[value]]
    return {"default": default, "values": present, "ranges": flat}


def bool_ranges(members: set[int]) -> list[int]:
    flags = [False] * N_CP
    for cp in members:
        flags[cp] = True
    flat: list[int] = []
    for start, length, _ in runs(flags, False):
        flat += [start, length]
    return flat


# --- Property value aliases ---------------------------------------------------------

LONG_VALUE_PROPS = {"blk", "GCB"}  # PRD §4.2 stores these as long names ("No_Block", "Other")


class Aliases:
    def __init__(self, folder: Path) -> None:
        self.prop: dict[str, str] = {}
        for line in read(folder, "PropertyAliases.txt").splitlines():
            data = line.split("#", 1)[0].strip()
            if data:
                names = [f.strip() for f in data.split(";")]
                for n in names:
                    self.prop[n] = names[0]
        self.values: dict[str, dict[str, Any]] = {}
        self._loose: dict[str, dict[str, Any]] = {}
        for line in read(folder, "PropertyValueAliases.txt").splitlines():
            data = line.split("#", 1)[0].strip()
            if not data:
                continue
            prop, *names = [f.strip() for f in data.split(";")]
            if prop == "ccc":
                canon: Any = int(names[0])
            else:
                canon = names[1] if prop in LONG_VALUE_PROPS and len(names) > 1 else names[0]
            table = self.values.setdefault(prop, {})
            lt = self._loose.setdefault(prop, {})
            for n in names:
                if n and n != "n/a":
                    table[n] = canon
                    lt[loose(n)] = canon

    def canon(self, prop: str, value: str) -> Any:
        hit = self._loose.get(prop, {}).get(loose(value))
        check(hit is not None, f"Unknown {prop} value {value!r}.")
        return hit


# --- ucd-core -----------------------------------------------------------------------


def enum_prop(
    al: Aliases, prop: str, text: str, default: str, select: str | None = None
) -> dict[str, Any]:
    """Expand an enumerated property file, applying @missing lines, then explicit lines."""

    def pick(fields: list[str]) -> str | None:
        if select is None:
            return fields[0]
        return fields[1] if fields[0] == select and len(fields) > 1 else None

    dflt = al.canon(prop, default)
    values: list[Any] = [dflt] * N_CP
    for lo, hi, fields in [*missing(text), *records(text)]:
        v = pick(fields)
        if v is not None and not v.startswith("<"):
            values[lo : hi + 1] = [al.canon(prop, v)] * (hi - lo + 1)
    return enum_table(values, dflt)


def build_core(folder: Path, version: str) -> dict[str, Any]:
    al = Aliases(folder)
    ud = list(unicode_data(read(folder, "UnicodeData.txt")))

    gc: list[Any] = ["Cn"] * N_CP
    ccc: list[Any] = [0] * N_CP
    decomp: dict[str, list[Any]] = {}
    upper: dict[str, list[int]] = {}
    lower: dict[str, list[int]] = {}
    title: dict[str, list[int]] = {}
    mirrored: set[int] = set()
    for lo, hi, f in ud:
        gc[lo : hi + 1] = [f[1]] * (hi - lo + 1)
        ccc[lo : hi + 1] = [int(f[2])] * (hi - lo + 1)
        if f[8] == "Y":
            mirrored.update(range(lo, hi + 1))
        if lo != hi:
            continue
        if f[4]:
            tag = f[4].split()[0] if f[4].startswith("<") else ""
            decomp[str(lo)] = [tag, cps(f[4].removeprefix(tag))]
        if f[11]:
            upper[str(lo)] = cps(f[11])
        if f[12]:
            lower[str(lo)] = cps(f[12])
        if f[13] or f[11]:  # UAX #44: an empty titlecase field means "same as uppercase"
            title[str(lo)] = cps(f[13] or f[11])

    # Cross-check gc against the derived file.
    dgc: list[Any] = ["Cn"] * N_CP
    for lo, hi, f in records(read(folder, "extracted/DerivedGeneralCategory.txt")):
        dgc[lo : hi + 1] = [f[0]] * (hi - lo + 1)
    check(gc == dgc, "UnicodeData.txt and DerivedGeneralCategory.txt disagree on gc.")

    # Full case mappings: simple mappings overlaid by unconditional SpecialCasing entries.
    special: list[list[Any]] = []
    for lo, _, f in records(read(folder, "SpecialCasing.txt")):
        if len(f) == 4:
            special.append([lo, cps(f[0]), cps(f[1]), cps(f[2]), f[3]])
            continue
        for table, field in ((lower, f[0]), (title, f[1]), (upper, f[2])):
            table[str(lo)] = cps(field)
    case: dict[str, Any] = {
        "upper": upper,
        "lower": lower,
        "title": title,
        "fold": {},
        "foldSimple": {},
        "foldTurkic": {},
        "special": special,
    }
    for name in ("upper", "lower", "title"):
        case[name] = {k: v for k, v in case[name].items() if v != [int(k)]}
    folds = {
        "C": ("fold", "foldSimple"),
        "F": ("fold",),
        "S": ("foldSimple",),
        "T": ("foldTurkic",),
    }
    for lo, _, f in records(read(folder, "CaseFolding.txt")):
        for target in folds[f[0]]:
            case[target][str(lo)] = cps(f[1])

    props: dict[str, Any] = {
        "gc": enum_table(gc, "Cn"),
        "ccc": enum_table(ccc, 0),
        "sc": enum_prop(al, "sc", read(folder, "Scripts.txt"), "Unknown"),
        "blk": enum_prop(al, "blk", read(folder, "Blocks.txt"), "No_Block"),
        "age": enum_prop(al, "age", read(folder, "DerivedAge.txt"), "Unassigned"),
        "bc": enum_prop(al, "bc", read(folder, "extracted/DerivedBidiClass.txt"), "L"),
        "ea": enum_prop(al, "ea", read(folder, "EastAsianWidth.txt"), "N"),
        "lb": enum_prop(al, "lb", read(folder, "LineBreak.txt"), "XX"),
        "GCB": enum_prop(al, "GCB", read(folder, "auxiliary/GraphemeBreakProperty.txt"), "Other"),
        "InCB": enum_prop(al, "InCB", read(folder, "DerivedCoreProperties.txt"), "None", "InCB"),
    }
    dnp = read(folder, "DerivedNormalizationProps.txt")
    for qc in ("NFC_QC", "NFD_QC", "NFKC_QC", "NFKD_QC"):
        props[qc] = enum_prop(al, qc, dnp, "Yes", qc)

    # Binary properties: every single-valued property in these files.
    binary: dict[str, set[int]] = {}
    for rel in ("PropList.txt", "DerivedCoreProperties.txt", "emoji/emoji-data.txt"):
        seen: set[str] = set()
        for lo, hi, f in records(read(folder, rel)):
            if len(f) == 1:
                name = "ExtPict" if f[0] == "Extended_Pictographic" else f[0]
                check(name not in binary or name in seen, f"{name} is defined in two files.")
                seen.add(name)
                binary.setdefault(name, set()).update(range(lo, hi + 1))
    binary["Bidi_Mirrored"] = mirrored  # UnicodeData.txt field 9 (f[8])
    fce = {
        cp
        for lo, hi, f in records(dnp)
        if f == ["Full_Composition_Exclusion"]
        for cp in range(lo, hi + 1)
    }
    excl = {lo for lo, _, _ in records(read(folder, "CompositionExclusions.txt"))}
    check(excl <= fce, "CompositionExclusions.txt is not a subset of Full_Composition_Exclusion.")

    # Script extensions.
    scx_values: list[Any] = [None] * N_CP
    for lo, hi, f in records(read(folder, "ScriptExtensions.txt")):
        codes = tuple(sorted(al.canon("sc", s) for s in f[0].split()))
        scx_values[lo : hi + 1] = [codes] * (hi - lo + 1)
    scx = enum_table(scx_values, None)

    blocks = [
        {"name": f[0], "start": lo, "end": hi} for lo, hi, f in records(read(folder, "Blocks.txt"))
    ]
    return {
        "version": version,
        "props": props,
        "binary": {k: bool_ranges(v) for k, v in binary.items()},
        "scx": {"sets": [list(s) for s in scx["values"]], "ranges": scx["ranges"]},
        "decomp": decomp,
        "compExcl": bool_ranges(fce),
        "case": case,
        "blocks": blocks,
        "aliases": {"prop": al.prop, "values": al.values},
    }


# --- ucd-names ----------------------------------------------------------------------

# UnicodeData.txt range labels -> name rule (Unicode Standard Table 4-8). None: unnamed.
RANGE_LABELS: dict[str, tuple[str, str] | None] = {
    "Hangul Syllable": ("NR1", "HANGUL SYLLABLE "),
    "CJK Ideograph": ("NR2", "CJK UNIFIED IDEOGRAPH-"),
    "CJK Ideograph Extension": ("NR2", "CJK UNIFIED IDEOGRAPH-"),
    "Tangut Ideograph": ("NR2", "TANGUT IDEOGRAPH-"),
    "Tangut Ideograph Supplement": ("NR2", "TANGUT IDEOGRAPH-"),
    "Jurchen Character": ("NR2", "JURCHEN CHARACTER-"),
    "Seal Character": ("NR2", "SMALL SEAL CHARACTER-"),
    "Non Private Use High Surrogate": None,
    "Private Use High Surrogate": None,
    "Low Surrogate": None,
    "Private Use": None,
    "Plane 15 Private Use": None,
    "Plane 16 Private Use": None,
}
# NR2 prefixes allowed in DerivedName.txt patterns; anything else fails the build.
NR2_PREFIXES = {
    "CJK UNIFIED IDEOGRAPH-",
    "CJK COMPATIBILITY IDEOGRAPH-",
    "EGYPTIAN HIEROGLYPH-",
    "TANGUT IDEOGRAPH-",
    "KHITAN SMALL SCRIPT CHARACTER-",
    "NUSHU CHARACTER-",
    "JURCHEN CHARACTER-",
    "SMALL SEAL CHARACTER-",
}
S_BASE, L_COUNT, V_COUNT, T_COUNT = 0xAC00, 19, 21, 28


def build_names(folder: Path, version: str) -> dict[str, Any]:
    explicit: dict[int, str] = {}
    hangul: list[tuple[int, int]] = []
    for lo, hi, f in unicode_data(read(folder, "UnicodeData.txt")):
        name = f[0]
        if lo == hi and not name.startswith("<"):
            explicit[lo] = name
        elif lo != hi:
            label = name.strip("<>").removesuffix(", First")
            key = (
                "CJK Ideograph Extension" if label.startswith("CJK Ideograph Extension ") else label
            )
            check(key in RANGE_LABELS, f"Unknown UnicodeData range label {label!r}.")
            rule = RANGE_LABELS[key]
            if rule and rule[0] == "NR1":
                hangul.append((lo, hi))

    jamo: dict[int, str] = {
        lo: (f[0] if f else "") for lo, _, f in records(read(folder, "Jamo.txt"))
    }
    j_l = [jamo[0x1100 + i] for i in range(L_COUNT)]
    j_v = [jamo[0x1161 + i] for i in range(V_COUNT)]
    j_t = [""] + [jamo[0x11A8 + i] for i in range(T_COUNT - 1)]

    # DerivedName.txt gives the NR2 pattern ranges and every other name, for cross-checking.
    patterns: list[list[Any]] = []
    derived: dict[int, str] = {}
    for lo, hi, f in records(read(folder, "extracted/DerivedName.txt")):
        if f[0].endswith("*"):
            prefix = f[0][:-1]
            check(prefix in NR2_PREFIXES, f"Unknown name pattern {f[0]!r}; update NR2_PREFIXES.")
            patterns.append([lo, hi, "NR2", prefix])
        else:
            derived[lo] = f[0]

    def in_pattern(cp: int) -> bool:
        return any(lo <= cp <= hi for lo, hi, _, _ in patterns)

    names = {cp: n for cp, n in explicit.items() if not in_pattern(cp)}
    mine = dict(names)
    for lo, hi in hangul:
        for cp in range(lo, hi + 1):
            s = cp - S_BASE
            mine[cp] = "HANGUL SYLLABLE " + j_l[s // 588] + j_v[s % 588 // 28] + j_t[s % 28]
    for cp, name in explicit.items():  # explicit names inside a pattern must match it
        if in_pattern(cp):
            pre = next(p[3] for p in patterns if p[0] <= cp <= p[1])
            check(name == f"{pre}{cp:04X}", f"U+{cp:04X} {name!r} does not match its pattern.")
    diff = set(mine.items()) ^ set(derived.items())
    check(not diff, f"Names disagree with DerivedName.txt, e.g. {sorted(diff)[:3]}.")

    aliases = [[lo, f[0], f[1]] for lo, _, f in records(read(folder, "NameAliases.txt"))]
    ranges = [[lo, hi, "NR1", "HANGUL SYLLABLE "] for lo, hi in hangul] + patterns
    return {
        "version": version,
        "names": [[cp, n] for cp, n in sorted(names.items())],
        "aliases": aliases,
        "ranges": sorted(ranges),
        "jamo": {"L": j_l, "V": j_v, "T": j_t},
    }


# --- ucd-security -------------------------------------------------------------------


def build_security(folder: Path, version: str) -> dict[str, Any]:
    confusables: dict[str, list[int]] = {}
    for lo, hi, f in records(read(folder, "security/confusables.txt")):
        check(lo == hi and f[1] == "MA", f"Unexpected confusables.txt entry at U+{lo:04X}.")
        confusables[str(lo)] = cps(f[0])

    status_text = read(folder, "security/IdentifierStatus.txt")
    allowed = {
        cp for lo, hi, f in records(status_text) if f[0] == "Allowed" for cp in range(lo, hi + 1)
    }
    status_default = next(f[0] for _, _, f in missing(status_text))

    type_text = read(folder, "security/IdentifierType.txt")
    type_default = next(f[0] for _, _, f in missing(type_text))
    types: list[Any] = [None] * N_CP
    for lo, hi, f in records(type_text):
        types[lo : hi + 1] = [tuple(sorted(f[0].split()))] * (hi - lo + 1)
    table = enum_table(types, None)
    return {
        "version": version,
        "confusables": confusables,
        "idStatus": {"default": status_default, "allowed": bool_ranges(allowed)},
        "idType": {
            "default": type_default,
            "sets": [list(s) for s in table["values"]],
            "ranges": table["ranges"],
        },
    }


# --- Output -------------------------------------------------------------------------


def encode(obj: dict[str, Any]) -> tuple[bytes, bytes]:
    raw = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return raw, gzip.compress(raw, compresslevel=9, mtime=0)


def build_all(version: str) -> dict[str, tuple[bytes, bytes]]:
    folder = DATA / version
    builders: dict[str, Callable[[Path, str], dict[str, Any]]] = {
        "core": build_core,
        "names": build_names,
        "security": build_security,
    }
    out: dict[str, tuple[bytes, bytes]] = {}
    for kind, fn in builders.items():
        raw, gz = encode(fn(folder, version))
        check(
            len(gz) <= BUDGETS[kind], f"ucd-{kind} is {len(gz)} bytes gzip; budget {BUDGETS[kind]}."
        )
        out[f"ucd-{kind}-{version}.json.gz"] = (raw, gz)
    return out


def drift(built: dict[str, tuple[bytes, bytes]]) -> list[str]:
    """Compare the committed artefacts with a fresh build. Compares the JSON payload,
    so a different zlib build cannot cause false drift; the copies must match each other."""
    problems = []
    for name, (raw, _) in built.items():
        copies = []
        for d in OUT_DIRS:
            path = d / name
            if not path.exists():
                problems.append(f"{path.relative_to(ROOT)} is missing.")
                continue
            data = path.read_bytes()
            copies.append(data)
            if gzip.decompress(data) != raw:
                problems.append(f"{path.relative_to(ROOT)} differs from a fresh build.")
        if len(set(copies)) > 1:
            problems.append(f"The copies of {name} are not byte-identical.")
    for d in OUT_DIRS:
        stale = {p.name for p in d.glob("ucd-*.json.gz")} - set(built)
        problems += [f"{(d / s).relative_to(ROOT)} is stale." for s in sorted(stale)]
    return problems


def diff_from(old: str, new: str) -> None:
    def load(v: str) -> tuple[dict[str, str], dict[str, int], set[int]]:
        folder = DATA / v
        blocks = {f[0]: lo for lo, _, f in records(read(folder, "Blocks.txt"))}
        scripts: dict[str, int] = {}
        for lo, hi, f in records(read(folder, "Scripts.txt")):
            scripts[f[0]] = scripts.get(f[0], 0) + hi - lo + 1
        assigned = {
            cp
            for lo, hi, _ in unicode_data(read(folder, "UnicodeData.txt"))
            for cp in range(lo, hi + 1)
        }
        return {k: f"U+{v:04X}" for k, v in blocks.items()}, scripts, assigned

    ob, os_, oa = load(old)
    nb, ns, na = load(new)
    print(f"UCD {old} -> {new}")
    print(f"  characters: +{len(na - oa)} added, -{len(oa - na)} removed")
    added = [f"{b} ({nb[b]})" for b in sorted(set(nb) - set(ob))]
    print(f"  blocks added: {', '.join(added) or 'none'}")
    print(f"  scripts added: {', '.join(sorted(set(ns) - set(os_))) or 'none'}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    constants = json.loads((ROOT / "project.constants.json").read_text(encoding="utf-8"))
    ap.add_argument("--version", default=constants["UCD_VERSION"])
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="fail if committed artefacts drift")
    mode.add_argument("--diff-from", metavar="VERSION", help="report changes since VERSION")
    args = ap.parse_args()
    try:
        if args.diff_from:
            diff_from(args.diff_from, args.version)
            return 0
        built = build_all(args.version)
        if args.check:
            problems = drift(built)
            for p in problems:
                print(f"drift: {p}", file=sys.stderr)
            print("ucd-drift: ok" if not problems else f"ucd-drift: {len(problems)} problem(s)")
            return 1 if problems else 0
        for d in OUT_DIRS:
            d.mkdir(parents=True, exist_ok=True)
            for old in d.glob("ucd-*.json.gz"):
                if old.name not in built:
                    old.unlink()
            for name, (_, gz) in built.items():
                (d / name).write_bytes(gz)
        for name, (raw, gz) in built.items():
            print(f"{name}: {len(raw):,} bytes raw, {len(gz):,} bytes gzip")
        return 0
    except BuildError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
