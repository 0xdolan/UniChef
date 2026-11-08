# SPDX-License-Identifier: GPL-3.0-or-later
"""Derive favicons, app and extension icons, store images and the RGB PDF from the
branding masters (PRD §9.2), and lint the masters (§9.1).

    uv run scripts/assets/build.py          # write assets/branding/dist/
    uv run scripts/assets/build.py --lint   # check assets/branding/source/*.svg

What to build is listed in ``assets/branding/manifest.json``. SVGs are rasterised by
``rsvg-convert`` (librsvg). ImageMagick (``magick``, or ``convert`` on ImageMagick 6)
only pads, composites and packs the ICO. Every PNG then goes through
``oxipng -o 4 --strip safe``. The output does not change between runs: metadata and
timestamps are stripped, and the PDF date comes from ``SOURCE_DATE_EPOCH``, which
defaults to the time of the last commit that touched the masters.

Needs rsvg-convert, ImageMagick and oxipng on PATH, and svgo from ``pnpm install``.
The dev container (``docker/Dev.Dockerfile``) has all of them.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BRANDING = ROOT / "assets" / "branding"
SOURCE = BRANDING / "source"
DIST = BRANDING / "dist"
MANIFEST = BRANDING / "manifest.json"

SVG_NS = "{http://www.w3.org/2000/svg}"
XLINK_HREF = "{http://www.w3.org/1999/xlink}href"
# Elements that run code, pull in other content, or embed a font or a raster.
FORBIDDEN = {"script", "foreignObject", "image", "font", "font-face", "iframe", "use"}


class BuildError(Exception):
    pass


# -- lint ------------------------------------------------------------------------------


def lint_svg(path: Path) -> list[str]:
    """Problems that make ``path`` unfit as a master (PRD §9.1); empty when it is clean."""
    problems: list[str] = []
    try:
        root = ET.parse(path).getroot()  # noqa: S314 (our own files, checked in review)
    except ET.ParseError as exc:
        return [f"not well-formed XML: {exc}"]
    if root.tag != f"{SVG_NS}svg":
        problems.append("the root element is not <svg> in the SVG namespace")
    if "viewBox" not in root.attrib:
        problems.append("no viewBox")
    for el in root.iter():
        tag = el.tag.removeprefix(SVG_NS)
        if tag in FORBIDDEN:
            problems.append(f"<{tag}> is not allowed")
        for name, value in el.attrib.items():
            if name in ("href", XLINK_HREF) and not value.startswith("#"):
                problems.append(f"<{tag}> links outside the file: {value[:60]}")
            if name.startswith("on"):
                problems.append(f"<{tag}> has an event handler ({name})")
            if "url(" in value and not re.fullmatch(r"\s*url\(#[\w-]+\)\s*", value):
                problems.append(f"<{tag} {name}> references a URL")
        text = el.text or ""
        if tag == "style" and ("@font-face" in text or "@import" in text or "url(" in text):
            problems.append("<style> loads a font, a stylesheet or a URL")
    return problems


def svgo_cmd() -> list[str]:
    svgo = ROOT / "node_modules" / ".bin" / "svgo"
    if not svgo.exists():
        raise BuildError("svgo is missing; run pnpm install")
    return [str(svgo), "--multipass", "--quiet"]


def lint() -> int:
    svgo = svgo_cmd()
    failed = 0
    for path in sorted(SOURCE.glob("*.svg")):
        problems = lint_svg(path)
        proc = subprocess.run([*svgo, "-i", str(path), "-o", "-"], capture_output=True, check=False)  # noqa: S603
        if proc.returncode:
            problems.append(f"svgo cannot optimise it: {proc.stderr.decode().strip()}")
        for problem in problems:
            sys.stderr.write(f"{path.relative_to(ROOT)}: {problem}\n")
        failed += bool(problems)
    if failed:
        sys.stderr.write(f"assets-lint: {failed} SVG master(s) failed\n")
        return 1
    sys.stdout.write(f"assets-lint: ok ({len(list(SOURCE.glob('*.svg')))} SVG masters)\n")
    return 0


# -- build -----------------------------------------------------------------------------


class Tools:
    def __init__(self) -> None:
        self.rsvg = self._need("rsvg-convert", "librsvg2-bin")
        magick = shutil.which("magick") or shutil.which("convert")
        if magick is None:
            raise BuildError("ImageMagick is missing (magick or convert); install imagemagick")
        self.magick = magick
        self.oxipng = self._need("oxipng", "https://github.com/shssoichiro/oxipng/releases")
        self.svgo = svgo_cmd()

    @staticmethod
    def _need(name: str, hint: str) -> str:
        path = shutil.which(name)
        if path is None:
            raise BuildError(f"{name} is missing; install it ({hint})")
        return path


def run(*cmd: str, env: dict[str, str] | None = None) -> None:
    proc = subprocess.run(cmd, capture_output=True, check=False, env=env)  # noqa: S603
    if proc.returncode:
        raise BuildError(f"{Path(cmd[0]).name} failed: {proc.stderr.decode().strip()}")


# Strip metadata and timestamps so that the PNG bytes depend only on the pixels.
PNG_CLEAN = ("-strip", "-define", "png:exclude-chunks=date,time")


def render(tools: Tools, src: Path, out: Path, w: int, h: int, *, keep_aspect: bool) -> None:
    aspect = ("-a",) if keep_aspect else ()
    run(tools.rsvg, *aspect, "-w", str(w), "-h", str(h), str(src), "-o", str(out))


def build_png(
    tools: Tools, spec: dict[str, Any], src: Path, out: Path, *, tmp: Path, bg: str
) -> None:
    w, h = spec["size"]
    if "box" not in spec:
        render(tools, src, out, w, h, keep_aspect=False)
        return
    inner = tmp / f"{out.stem}-inner.png"
    render(tools, src, inner, *spec["box"], keep_aspect=True)
    canvas = f"xc:{bg}" if spec.get("fill") else "xc:none"
    run(tools.magick, "-size", f"{w}x{h}", canvas, str(inner), "-gravity", "center", "-composite",
        *PNG_CLEAN, f"PNG32:{out}")  # fmt: skip


def build_one(
    tools: Tools, spec: dict[str, Any], manifest: dict[str, Any], tmp: Path
) -> list[Path]:
    sources = {k: BRANDING / v for k, v in manifest["sources"].items()}
    kind = spec["kind"]
    out = DIST / spec["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    if kind == "png":
        build_png(tools, spec, sources[spec["source"]], out, tmp=tmp, bg=manifest["background"])
    elif kind == "ico":
        frames = []
        for size, key in spec["sources"].items():
            frame = tmp / f"ico-{size}.png"
            render(tools, sources[key], frame, int(size), int(size), keep_aspect=False)
            frames.append(str(frame))
        run(tools.magick, *frames, "-strip", str(out))
    elif kind == "svg":
        run(*tools.svgo, "-i", str(sources[spec["source"]]), "-o", str(out))
    elif kind == "pdf":
        run(tools.rsvg, "-f", "pdf", str(sources[spec["source"]]), "-o", str(out), env=pdf_env())
    elif kind == "screenshot":
        w, h = spec["size"]
        outs = []
        for name in spec["names"]:
            src = (BRANDING / spec["from"] / f"{name}.png").resolve()
            if not src.exists():
                raise BuildError(f"{src.relative_to(ROOT)} is missing; run make screenshots")
            dest = DIST / spec["out"].format(name=name)
            run(tools.magick, str(src), "-resize", f"{w}x{h}^", "-gravity", "center",
                "-extent", f"{w}x{h}", *PNG_CLEAN, str(dest))  # fmt: skip
            outs.append(dest)
        return outs
    else:
        raise BuildError(f"{spec['out']}: unknown kind {kind!r}")
    return [out]


def pdf_env() -> dict[str, str]:
    env = dict(os.environ)
    if "SOURCE_DATE_EPOCH" not in env:
        proc = subprocess.run(  # noqa: S603
            ["git", "log", "-1", "--format=%ct", "--", str(SOURCE)],  # noqa: S607
            capture_output=True, text=True, check=False, cwd=ROOT,
        )  # fmt: skip
        env["SOURCE_DATE_EPOCH"] = proc.stdout.strip() or "0"
    return env


def build() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    tools = Tools()
    if DIST.exists():
        shutil.rmtree(DIST)
    written: list[Path] = []
    with tempfile.TemporaryDirectory() as tmp:
        for spec in manifest["outputs"]:
            written += build_one(tools, spec, manifest, Path(tmp))
    pngs = [str(p) for p in written if p.suffix == ".png"]
    run(tools.oxipng, "-q", "-o", "4", "--strip", "safe", *pngs)
    for path in written:
        sys.stdout.write(f"{path.relative_to(ROOT)}\n")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lint", action="store_true", help="check the SVG masters only")
    args = parser.parse_args()
    try:
        return lint() if args.lint else build()
    except BuildError as exc:
        sys.stderr.write(f"assets: {exc}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
