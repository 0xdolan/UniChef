# SPDX-License-Identifier: GPL-3.0-or-later
"""Record the CLI tour as SVG terminal frames (PRD §9.3).

Each command runs in a child process with colour forced and 100 columns, once per
theme. Rich records the coloured output and writes an SVG to
``build/screenshots/cli/<theme>/<name>.svg``. ``clients/web/screenshots/cli.spec.ts``
then renders every SVG to PNG at 1x and 2x with Chromium; the PRD names rsvg-convert,
but Chromium is already a dev dependency and draws emoji and box characters the same
way on every machine.

Run it with ``make screenshots``.
"""

import argparse
import io
import os
import shlex
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

from rich.console import Console
from rich.terminal_theme import TerminalTheme
from rich.text import Text

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "build" / "screenshots" / "cli"
WIDTH = 100
GALLERY = ROOT / "clients" / "web" / "src" / "features" / "recipes" / "gallery"

# Window colours follow the CLI palette (PRD §5.5); the 16 ANSI colours are unused
# because the CLI writes truecolour.
_ANSI = [(0, 0, 0)] * 16
THEMES = {
    "dark": TerminalTheme((0x14, 0x16, 0x1F), (0xE6, 0xE8, 0xEE), _ANSI[:8], _ANSI[8:]),
    "light": TerminalTheme((0xFA, 0xFA, 0xFC), (0x1B, 0x1F, 0x2A), _ANSI[:8], _ANSI[8:]),
}

# A source file with a Trojan Source line (CVE-2021-42574): an RLO reorders what a
# reviewer sees. It is written at run time so the repository holds no bidi controls.
TROJAN = (
    "const access = 'user';\n"
    "if (access !== 'admin\u202e \u2066// check role\u2069 \u2066') {\n"
    "  deny();\n"
    "}\n"
)

# name -> CLI arguments (after the global options)
SHOTS: dict[str, list[str]] = {
    "inspect": ["inspect", "p\u0430ypal"],  # Cyrillic a: a mixed-script look-alike
    "char": ["char", "U+202E"],
    "search": ["search", "--limit", "6", "black chess"],
    "op": ["op", "to-punycode", "--arg", "domain=true", "münchen.de"],
    "bake": ["bake", "-r", str(GALLERY / "reveal-invisible.json"), "a\u200bb\u2060c"],
    "scan": ["scan", "auth.js"],
}


def run(args: list[str], theme: str, cwd: Path) -> str:
    env = {**os.environ, "COLUMNS": str(WIDTH), "FORCE_COLOR": "1"}
    env.pop("NO_COLOR", None)
    cmd = [sys.executable, "-m", "unichef", "--format", "table", "--theme", theme, *args]
    proc = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, check=False)  # noqa: S603
    return (proc.stdout + proc.stderr).decode("utf-8")


def _word(word: str) -> str:
    """Quote one word for the prompt line; format characters become ``$'\\uXXXX'``."""
    word = word.replace(str(GALLERY) + os.sep, "")
    if not any(unicodedata.category(c) == "Cf" for c in word):
        return shlex.quote(word)
    return (
        "$'"
        + "".join(c if unicodedata.category(c) != "Cf" else f"\\u{ord(c):04x}" for c in word)
        + "'"
    )


def shown(args: list[str]) -> str:
    """The command as the reader would type it."""
    return "unichef " + " ".join(_word(a) for a in args)


# Rich draws with Fira Code; its box-drawing glyphs leave gaps at Rich's line height.
# JetBrains Mono (OFL-1.1) joins cleanly. The pinned release is the fallback when it
# is not installed.
_FONT_URL = "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/webfonts"
_FONT_FACES = "".join(
    f"""
    @font-face {{
        font-family: "JetBrains Mono";
        src: local("JetBrains Mono {style}"), url("{_FONT_URL}/JetBrainsMono-{style}.woff2");
        font-weight: {weight};
    }}"""
    for style, weight in (("Regular", 400), ("Bold", 700))
)


def _font(svg: str) -> str:
    start = svg.index("@font-face")
    end = svg.rindex("}", 0, svg.index(".terminal-")) + 1
    svg = svg[:start] + _FONT_FACES.strip() + svg[end:]
    return svg.replace(
        "font-family: Fira Code, monospace;", 'font-family: "JetBrains Mono", monospace;'
    )


def record(name: str, args: list[str], theme: str, cwd: Path) -> Path:
    console = Console(
        file=io.StringIO(), record=True, width=WIDTH, force_terminal=True, color_system="truecolor"
    )
    prompt = Text("$ ", style="bold")
    prompt.append(shown(args))
    console.print(prompt)
    console.print(Text.from_ansi(run(args, theme, cwd)), end="")
    path = OUT / theme / f"{name}.svg"
    path.parent.mkdir(parents=True, exist_ok=True)
    svg = console.export_svg(title=f"unichef {name}", theme=THEMES[theme])
    path.write_text(_font(svg), encoding="utf-8")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "names", nargs="*", metavar="NAME", help=f"shots to record: {', '.join(SHOTS)}"
    )
    names = parser.parse_args().names or list(SHOTS)
    unknown = sorted(set(names) - SHOTS.keys())
    if unknown:
        parser.error(f"unknown shot: {', '.join(unknown)}")
    with tempfile.TemporaryDirectory() as tmp:
        cwd = Path(tmp)
        (cwd / "auth.js").write_text(TROJAN, encoding="utf-8")
        for theme in THEMES:
            for name in names:
                sys.stdout.write(f"{record(name, SHOTS[name], theme, cwd).relative_to(ROOT)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
