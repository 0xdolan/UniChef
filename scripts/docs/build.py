# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build the generated parts of the documentation from spec/ops.json (FR-013).

The docs are Markdown under docs/: concept guides in docs/learn/, one reference page per
operation in docs/reference/ops/<id>.md, and two indexes (docs/README.md, the whole table of
contents, and docs/reference/README.md). The prose is written by hand. This script owns
the blocks between `<!-- docs:NAME -->` and `<!-- /docs:NAME -->` markers:

- **head** (operation pages): breadcrumb, title, summary and facts.
- **usage** (operation pages): arguments, examples (tested in both cores), and how to run it
  in the web app, the CLI, Python and TypeScript.
- **crumbs** (guides): breadcrumb.
- **ops** (guides): the operations the guide explains.
- **toc** (docs/README.md) and **index** (docs/reference/README.md).
- **nav** (every page): previous, contents and next. The reading order is the table of
  contents: the docs home, the guides, the reference index, then each operation by category.

`--write` updates the blocks and creates a skeleton for a missing operation page. Without it
the script checks:
- that every block is current;
- that every page has its hand-written sections ("How it works" and "Learn more" with a
  link), with no TODO left;
- that every relative link resolves.

The web app renders the same files at #/docs (clients/web/vite.docs.ts).

    uv run scripts/docs/build.py [--write]
"""

import base64
import json
import re
import shlex
import sys
import unicodedata
import zlib
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
OPS_DIR = DOCS / "reference" / "ops"
CONSTANTS = json.loads((ROOT / "project.constants.json").read_text("utf-8"))
PAGES_URL: str = CONSTANTS["PAGES_URL"]

# Reading order of the concept guides (docs/learn/<slug>.md).
GUIDES = [
    "how-unichef-works",
    "text-and-bytes",
    "unicode",
    "base-encodings",
    "web-encodings",
    "hashing",
    "hmac-and-key-derivation",
    "encryption",
    "classical-ciphers",
    "letter-codes",
    "compression",
    "unicode-security",
    "data-and-text",
    "text-formats",
    "number-formats",
    "sets-and-distances",
    "small-codecs",
]

# Category order in the reference, and the guide that explains each category.
CATEGORIES = {
    "Encoding": "base-encodings",
    "Unicode": "unicode",
    "Security": "unicode-security",
    "Hashing": "hashing",
    "Crypto": "encryption",
    "Compression": "compression",
    "Data": "data-and-text",
    "Text": "data-and-text",
    "Flow": "how-unichef-works",
}

# Operations explained by a different guide than their category's.
GUIDE_FOR_OP = {
    "url-encode": "web-encodings",
    "url-decode": "web-encodings",
    "html-entity-encode": "web-encodings",
    "html-entity-decode": "web-encodings",
    "quoted-printable-encode": "web-encodings",
    "quoted-printable-decode": "web-encodings",
    "to-punycode": "web-encodings",
    "from-punycode": "web-encodings",
    "idna-to-ascii": "web-encodings",
    "idna-to-unicode": "web-encodings",
    "encode-text": "text-and-bytes",
    "decode-text": "text-and-bytes",
    "utf8-explain": "text-and-bytes",
    "to-code-points": "text-and-bytes",
    "from-code-points": "text-and-bytes",
    "hmac": "hmac-and-key-derivation",
    "pbkdf2": "hmac-and-key-derivation",
    "rot13": "classical-ciphers",
    "rot47": "classical-ciphers",
    "atbash": "classical-ciphers",
    "vigenere-encode": "classical-ciphers",
    "vigenere-decode": "classical-ciphers",
    "xor": "classical-ciphers",
    "rot8000": "classical-ciphers",
    "a1z26-encode": "classical-ciphers",
    "a1z26-decode": "classical-ciphers",
    "bacon-encode": "classical-ciphers",
    "bacon-decode": "classical-ciphers",
    "to-morse-code": "letter-codes",
    "from-morse-code": "letter-codes",
    "to-nato-alphabet": "letter-codes",
    "to-braille": "letter-codes",
    "from-braille": "letter-codes",
    "leet-speak": "letter-codes",
    "to-snake-case": "text-formats",
    "to-kebab-case": "text-formats",
    "to-camel-case": "text-formats",
    "to-hexdump": "text-formats",
    "from-hexdump": "text-formats",
    "to-hex-content": "text-formats",
    "from-hex-content": "text-formats",
    "escape-string": "text-formats",
    "unescape-string": "text-formats",
    "escape-smart-characters": "text-formats",
    "wrap": "text-formats",
    "to-float": "number-formats",
    "from-float": "number-formats",
    "to-bech32": "number-formats",
    "from-bech32": "number-formats",
    "to-bcd": "number-formats",
    "from-bcd": "number-formats",
    "text-integer": "number-formats",
    "pem-to-hex": "number-formats",
    "hex-to-pem": "number-formats",
    "set-union": "sets-and-distances",
    "set-intersection": "sets-and-distances",
    "set-difference": "sets-and-distances",
    "symmetric-difference": "sets-and-distances",
    "cartesian-product": "sets-and-distances",
    "power-set": "sets-and-distances",
    "hamming-distance": "sets-and-distances",
    "levenshtein-distance": "sets-and-distances",
    "caret-m-decode": "small-codecs",
    "to-rison": "small-codecs",
    "from-rison": "small-codecs",
    "encode-netbios-name": "small-codecs",
    "decode-netbios-name": "small-codecs",
    "citrix-ctx1-encode": "small-codecs",
    "citrix-ctx1-decode": "small-codecs",
    "unicode-text-format": "small-codecs",
}

# Other project documents listed in the table of contents.
PROJECT_DOCS = [
    ("Introduction and install", "../INTRODUCTION.md"),
    ("Roadmap", "roadmap.md"),
    ("CyberChef operations and how they map", "upstream/cyberchef-operations.md"),
    ("Brand guide", "branding/README.md"),
    ("Release process", "release/process.md"),
    ("Publishing the extensions", "extensions/publishing.md"),
    ("Contributing", "../CONTRIBUTING.md"),
    ("Security policy", "../SECURITY.md"),
]

BLOCK = re.compile(r"<!-- docs:(\w+) -->\n.*?<!-- /docs:\1 -->", re.S)
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")


@dataclass(frozen=True)
class Page:
    path: Path
    title: str

    def link_from(self, other: Path) -> str:
        return rel(self.path, other)


def rel(target: Path, source: Path) -> str:
    """The relative link from the page `source` to `target`."""
    return Path(*_relparts(target, source.parent)).as_posix()


def _relparts(target: Path, start: Path) -> list[str]:
    t, s = target.resolve().parts, start.resolve().parts
    i = 0
    while i < min(len(t), len(s)) and t[i] == s[i]:
        i += 1
    return [".."] * (len(s) - i) + list(t[i:])


def block(name: str, body: str) -> str:
    return f"<!-- docs:{name} -->\n{body.strip()}\n<!-- /docs:{name} -->"


def load_ops() -> list[dict]:
    ops = json.loads((ROOT / "spec/ops.json").read_text("utf-8"))["ops"]
    unknown = {o["category"] for o in ops} - CATEGORIES.keys()
    if unknown:
        sys.exit(f"docs: add these categories to CATEGORIES: {sorted(unknown)}")
    order = list(CATEGORIES)
    return sorted(ops, key=lambda o: (order.index(o["category"]), o["name"].casefold()))


def guide_title(slug: str) -> str:
    path = DOCS / "learn" / f"{slug}.md"
    if not path.exists():
        return slug
    m = re.search(r"^# (.+)$", path.read_text("utf-8"), re.M)
    return m.group(1) if m else slug


def guide_of(op: dict) -> str:
    return GUIDE_FOR_OP.get(op["id"], CATEGORIES[op["category"]])


def summary(text: str) -> str:
    """The first sentence of an operation description."""
    m = re.match(r"(.+?[.!?])(\s|$)", text)
    return m.group(1) if m else text


# --- Values shown in tables and snippets ---------------------------------------------------


MAX_BMP = 0xFFFF


def hidden(ch: str) -> bool:
    """True for characters that do not show: controls, format characters and odd spaces."""
    return ch != " " and unicodedata.category(ch)[0] in "CZ"


def escaped(text: str, astral: str) -> str:
    """Escape hidden characters as ``\\uXXXX``; `astral` formats code points above U+FFFF."""
    return "".join(
        (f"\\u{ord(ch):04x}" if ord(ch) <= MAX_BMP else astral.format(ord(ch)))
        if hidden(ch)
        else ch
        for ch in text
    )


def js_str(text: str) -> str:
    """A JSON or JavaScript string literal in which hidden characters are escapes."""
    return escaped(json.dumps(text, ensure_ascii=False), "\\u{{{0:x}}}")


def py_str(text: str) -> str:
    """A Python string literal in which hidden characters are escapes."""
    return escaped(json.dumps(text, ensure_ascii=False), "\\U{0:08x}")


def sh_str(text: str) -> str:
    """A shell word; text with hidden characters uses ANSI-C quoting (bash, zsh)."""
    if not any(hidden(ch) for ch in text):
        return shlex.quote(text)
    body = text.replace("\\", "\\\\").replace("'", "\\'")
    return "$'" + escaped(body, "\\U{0:08x}") + "'"


def shown(text: str) -> str:
    """`text` as inline code; hidden characters become escapes."""
    body = js_str(text)[1:-1] if any(hidden(ch) for ch in text) else text
    body = body.replace("|", "\\|")
    if body == "":
        return "*(empty)*"
    fence = "``" if "`" in body else "`"
    pad = " " if body.startswith("`") or body.endswith("`") else ""
    return f"{fence}{pad}{body}{pad}{fence}"


def arg_value(value: object) -> str:
    """An argument value as the CLI's `--arg NAME=VALUE` spells it."""
    if isinstance(value, dict) and "encoding" in value:
        return f"{value['encoding']}:{value['value']}"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def arg_type(spec: dict) -> str:
    kind = spec["kind"]
    if kind == "bytes":
        text = "bytes (" + ", ".join(spec.get("encodings", [])) + ")"
    elif kind == "enum":
        text = "choice"
    elif kind in ("integer", "number"):
        lo, hi = spec.get("minimum"), spec.get("maximum")
        bounds = f" {lo} to {hi}" if lo is not None and hi is not None else ""
        bounds = bounds or (f" ≥ {lo}" if lo is not None else "")
        text = f"{kind}{bounds}"
    else:
        text = kind
    if spec.get("secret"):
        text += ", secret"
    return text


def arg_values(spec: dict) -> str:
    if spec.get("options"):
        return ", ".join(f"`{o}`" for o in spec["options"])
    if spec.get("flags"):
        return "any of " + ", ".join(f"`{f}`" for f in spec["flags"])
    return ""


def share_link(op: dict, example: dict) -> str:
    """A web app link that opens this example: the same fragment Copy link makes."""

    def pack(text: str) -> str:
        z = zlib.compressobj(9, zlib.DEFLATED, -15)
        raw = z.compress(text.encode("utf-8")) + z.flush()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    recipe = {"version": 1, "steps": [{"op": op["id"], "args": example.get("args", {})}]}
    query = "r=" + pack(json.dumps(recipe, ensure_ascii=False, separators=(",", ":")))
    if example.get("input", "") != "":
        query += "&i=" + pack(example["input"])
    return f"{PAGES_URL}#/?{query}"


def py_literal(value: object) -> str:
    return (
        json.dumps(value, ensure_ascii=False)
        .replace(": true", ": True")
        .replace(": false", ": False")
    )


def usage(op: dict) -> str:
    out = ["## Arguments", ""]
    if op["args"]:
        out += ["| Name | Type | Default | Values |", "|---|---|---|---|"]
        for spec in op["args"]:
            default = spec.get("default")
            out.append(
                f"| `{spec['name']}` | {arg_type(spec)} | "
                f"{shown(arg_value(default)) if default not in (None, '') else '—'} | "
                f"{arg_values(spec) or '—'} |"
            )
    else:
        out.append("This operation takes no arguments.")
    examples = op.get("examples", [])
    if examples:
        out += ["", "## Examples", "", "| Input | Arguments | Output |", "|---|---|---|"]
        for ex in examples:
            args = ", ".join(
                f"`{k}={arg_value(v)}`".replace("|", "\\|") for k, v in ex.get("args", {}).items()
            )
            out.append(
                f"| {shown(ex.get('input', ''))} | {args or '—'} | "
                f"{shown(arg_value(ex['output']))} |"
            )
    ex = examples[0] if examples else {"input": "", "args": {}, "output": None}
    cli_args = "".join(
        f" --arg {shlex.quote(f'{k}={arg_value(v)}')}" for k, v in ex.get("args", {}).items()
    )
    text = ex.get("input", "")
    cli_input = f" {sh_str(text)}" if text and "\n" not in text else ""
    args_json = py_literal(ex.get("args", {}))
    out += [
        "",
        "## Use it",
        "",
        f"**Web app:** [open this example in UniChef]({share_link(op, ex)}), or search for"
        f' "{op["name"]}" in the operation list.',
        "",
        "**CLI:**",
        "",
        "```sh",
        f"unichef op {op['id']}{cli_args}{cli_input}",
        "```",
        "",
        "**Python:**",
        "",
        "```python",
        "from unichef.core.dish import Dish",
        "from unichef.core.runner import run_operation",
        "",
        f"result = run_operation({json.dumps(op['id'])}, {args_json}, "
        f"Dish.of_string({py_str(text)}))",
        "print(result.dish.value)",
        "```",
        "",
        "**TypeScript:**",
        "",
        "```ts",
        "import { runOperation } from '@unichef/core';",
        "",
        f"const result = await runOperation({json.dumps(op['id'])}, "
        f"{json.dumps(ex.get('args', {}), ensure_ascii=False)}, "
        f"{{ type: 'string', value: {js_str(text)} }});",
        "console.log(result.dish.value);",
        "```",
    ]
    return "\n".join(out)


# --- Pages ---------------------------------------------------------------------------------


def sequence(ops: list[dict]) -> list[Page]:
    pages = [Page(DOCS / "README.md", "Documentation")]
    pages += [Page(DOCS / "learn" / f"{g}.md", guide_title(g)) for g in GUIDES]
    pages.append(Page(DOCS / "reference" / "README.md", "Operation reference"))
    pages += [Page(OPS_DIR / f"{o['id']}.md", o["name"]) for o in ops]
    return pages


def nav(pages: list[Page], i: int) -> str:
    here = pages[i].path
    parts = []
    if i > 0:
        parts.append(f"[← {pages[i - 1].title}]({pages[i - 1].link_from(here)})")
    if i > 0:
        parts.append(f"[Contents]({pages[0].link_from(here)})")
    if i + 1 < len(pages):
        parts.append(f"[{pages[i + 1].title} →]({pages[i + 1].link_from(here)})")
    return "---\n\n" + " · ".join(parts)


def toc(ops: list[dict]) -> str:
    here = DOCS / "README.md"
    out = ["## Learn", ""]
    out += [f"{n}. [{guide_title(g)}](learn/{g}.md)" for n, g in enumerate(GUIDES, 1)]
    out += ["", "## Operation reference", "", "[All operations](reference/README.md)", ""]
    for cat in CATEGORIES:
        links = [
            f"[{o['name']}]({rel(OPS_DIR / (o['id'] + '.md'), here)})"
            for o in ops
            if o["category"] == cat
        ]
        out.append(f"- **{cat}:** " + ", ".join(links))
    out += ["", "## Project", ""]
    out += [f"- [{title}]({link})" for title, link in PROJECT_DOCS]
    return "\n".join(out)


def index(ops: list[dict]) -> str:
    out = []
    for cat, guide in CATEGORIES.items():
        mine = [o for o in ops if o["category"] == cat]
        out += [f"## {cat}", "", f"Background: [{guide_title(guide)}](../learn/{guide}.md)", ""]
        out += ["| Operation | What it does |", "|---|---|"]
        out += [
            f"| [{o['name']}](ops/{o['id']}.md) | {summary(o['description']).replace('|', '\\|')} |"
            for o in mine
        ]
        out.append("")
    return "\n".join(out)


def head(op: dict) -> str:
    guide = guide_of(op)
    return "\n".join(
        [
            f"[Docs](../../README.md) › [Reference](../README.md) › {op['category']}",
            "",
            f"# {op['name']}",
            "",
            op["description"],
            "",
            "| Id | Input | Output | Background |",
            "|---|---|---|---|",
            f"| `{op['id']}` | {op['input']} | {op['output']} | "
            f"[{guide_title(guide)}](../../learn/{guide}.md) |",
        ]
    )


def guide_ops(slug: str, ops: list[dict]) -> str:
    mine = [o for o in ops if guide_of(o) == slug]
    if not mine:
        return "This guide has no operations of its own."
    return (
        "Operations explained here: "
        + ", ".join(f"[{o['name']}](../reference/ops/{o['id']}.md)" for o in mine)
        + "."
    )


SKELETON = """{head}

## How it works

TODO

{usage}

## Learn more

TODO

{nav}
"""


def expected(pages: list[Page], ops: list[dict]) -> dict[Path, dict[str, str]]:
    """The generated blocks each page must contain, by name."""
    by_id = {o["id"]: o for o in ops}
    want: dict[Path, dict[str, str]] = {}
    for i, page in enumerate(pages):
        blocks = {"nav": nav(pages, i)}
        if page.path.parent == OPS_DIR:
            op = by_id[page.path.stem]
            blocks |= {"head": head(op), "usage": usage(op)}
        elif page.path.parent == DOCS / "learn":
            blocks |= {
                "crumbs": "[Docs](../README.md) › Learn",
                "ops": guide_ops(page.path.stem, ops),
            }
        elif page.path == DOCS / "README.md":
            blocks["toc"] = toc(ops)
        else:
            blocks |= {"crumbs": "[Docs](../README.md) › Reference", "index": index(ops)}
        want[page.path] = blocks
    return want


def render(text: str, blocks: dict[str, str]) -> tuple[str, list[str]]:
    """`text` with its blocks replaced, and the names of required blocks it lacks."""
    seen: set[str] = set()

    def swap(m: re.Match[str]) -> str:
        seen.add(m.group(1))
        return block(m.group(1), blocks[m.group(1)]) if m.group(1) in blocks else m.group(0)

    return BLOCK.sub(swap, text), sorted(blocks.keys() - seen)


def problems_in(path: Path, text: str, is_op: bool) -> list[str]:
    found = []
    where = path.relative_to(ROOT)
    if "TODO" in text:
        found.append(f"{where}: replace the TODO with the explanation")
    if is_op:
        for section in ("## How it works", "## Learn more"):
            if section not in text:
                found.append(f"{where}: missing the '{section}' section")
        more = text.split("## Learn more", 1)[-1]
        if "](http" not in more:
            found.append(f"{where}: 'Learn more' needs at least one external link")
    for target in LINK.findall(text):
        if re.match(r"[a-z]+:", target) or target.startswith("#"):
            continue
        if not (path.parent / target.split("#")[0]).exists():
            found.append(f"{where}: broken link {target}")
    return found


def main() -> int:
    write = "--write" in sys.argv[1:]
    ops = load_ops()
    pages = sequence(ops)
    problems: list[str] = []
    stray = set(OPS_DIR.glob("*.md")) - {p.path for p in pages}
    problems += [f"{p.relative_to(ROOT)}: no operation has this id" for p in sorted(stray)]
    for path, blocks in expected(pages, ops).items():
        is_op = path.parent == OPS_DIR
        if not path.exists():
            if not (write and is_op):
                problems.append(f"{path.relative_to(ROOT)}: missing")
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(SKELETON.format(**{k: block(k, v) for k, v in blocks.items()}), "utf-8")
        text = path.read_text("utf-8")
        new, lacking = render(text, blocks)
        problems += [f"{path.relative_to(ROOT)}: add a <!-- docs:{b} --> block" for b in lacking]
        if new != text:
            if write:
                path.write_text(new, "utf-8")
            else:
                problems.append(f"{path.relative_to(ROOT)}: out of date (run with --write)")
        problems += problems_in(path, new, is_op)
    for line in problems:
        print(line, file=sys.stderr)
    print(f"docs: {len(pages)} pages, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
