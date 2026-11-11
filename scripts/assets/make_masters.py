# SPDX-License-Identifier: GPL-3.0-or-later
"""Generate the UniChef branding masters in assets/branding/source/.

The mark is pure geometry, defined below. The wordmark is converted to outlines from
Bricolage Grotesque (SIL OFL 1.1), so the SVGs never embed or reference a font.

Usage (font: https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque):

    uv run --no-project --with fonttools==4.68.0 --with uharfbuzz==0.57.0 \
        python scripts/assets/make_masters.py \
        --font "BricolageGrotesque[opsz,wdth,wght].ttf" --out assets/branding/source

See docs/branding/README.md for the design rules behind every number here.
"""

import argparse
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

# --- Palette (PRD §5.5) --------------------------------------------------------------
DARK = {"mark": "#8B7CF6", "dots": "#F5A524", "uni": "#E6E8EE", "chef": "#8B7CF6"}
LIGHT = {"mark": "#5B4BD8", "dots": "#B26B00", "uni": "#1B1F2A", "chef": "#5B4BD8"}
MONO = {"mark": "#000000", "dots": "#000000", "uni": "#000000", "chef": "#000000"}
SURFACE = "#0F1020"

# --- Mark geometry, 1024-unit canvas (a 64-unit design grid scaled by 16) -------------
# U: stroke 144 with round caps; stem centre lines x=224 and x=800; bowl centre (512, 596).
U_PATH = (
    "M152 404A72 72 0 0 1 296 404V596A216 216 0 0 0 728 596V404"
    "A72 72 0 0 1 872 404V596A360 360 0 0 1 152 596Z"
)
DOTS = ((352, 164, 96), (672, 164, 96))  # (cx, cy, r): the U+0308 diaeresis
MARK_BOX = (152, 68, 872, 956)  # tight bounds of the mark: x0, y0, x1, y1

# 16 px variant, hand-fitted to the pixel grid (stems and dots land on whole pixels).
U16_PATH = "M3 8A1 1 0 0 1 5 8V10A3 3 0 0 0 11 10V8A1 1 0 0 1 13 8V10A5 5 0 0 1 3 10Z"
DOTS16 = ((5.5, 3.5, 1.5), (10.5, 3.5, 1.5))

# --- Wordmark settings ----------------------------------------------------------------
AXES = {"wght": 700, "wdth": 100, "opsz": 48}
TRACKING_EM = -0.02  # letter-spacing
CAP_HEIGHT = 420  # wordmark cap height in mark units (0.47 of the mark's height)
GAP = 200  # space between mark and wordmark, in mark units

# --- Banner: the lockup over the tagline, for social cards and store tiles --------------
TAGLINE = "The cybersecurity and Unicode workbench"
TAGLINE_AXES = {"wght": 500, "wdth": 100, "opsz": 24}
TAGLINE_GAP = 240  # from the bottom of the mark to the tagline's cap line, in mark units

HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n'


def n(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


def mark_group(c: dict[str, str], transform: str = "") -> str:
    t = f' transform="{transform}"' if transform else ""
    dots = "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in DOTS)
    return (
        f'<g id="mark"{t}><path id="mark-u" fill="{c["mark"]}" d="{U_PATH}"/>'
        f'<g id="mark-dots" fill="{c["dots"]}">{dots}</g></g>'
    )


def svg(view_box: str, title: str, body: str, w: str, h: str) -> str:
    return (
        f'{HEAD}<svg xmlns="http://www.w3.org/2000/svg" version="1.1" '
        f'width="{w}" height="{h}" viewBox="{view_box}" role="img">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def wordmark_paths(font_path: Path) -> tuple[list[tuple[str, str]], float, float]:
    """Return [(part, path_d)], the advance width and the scale, in mark units."""
    font = instantiateVariableFont(TTFont(font_path), AXES, inplace=False)
    upem = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight
    scale = CAP_HEIGHT / cap

    blob = hb.Blob.from_file_path(str(font_path))
    hbfont = hb.Font(hb.Face(blob))
    hbfont.set_variations(AXES)
    buf = hb.Buffer()
    buf.add_str("UniChef")
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": False})

    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    track = TRACKING_EM * upem
    parts: dict[str, list[str]] = {"uni": [], "chef": []}
    x = 0.0
    infos, positions = buf.glyph_infos, buf.glyph_positions
    for i, (info, pos) in enumerate(zip(infos, positions, strict=True)):
        name = order[info.codepoint]
        pen = SVGPathPen(glyphs, ntos=n)
        # font units, y up  ->  mark units, y down, baseline at 0
        tpen = TransformPen(pen, (scale, 0, 0, -scale, (x + pos.x_offset) * scale, 0))
        glyphs[name].draw(tpen)
        parts["uni" if info.cluster < 3 else "chef"].append(pen.getCommands())
        x += pos.x_advance + (track if i < len(infos) - 1 else 0)
    return [(k, "".join(v)) for k, v in parts.items()], x * scale, scale


def text_path(font_path: Path, text: str, axes: dict[str, float]) -> tuple[str, float, float]:
    """Outline `text` at 1 unit per font unit: (path_d, advance width, cap height)."""
    font = instantiateVariableFont(TTFont(font_path), axes, inplace=False)
    hbfont = hb.Font(hb.Face(hb.Blob.from_file_path(str(font_path))))
    hbfont.set_variations(axes)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": False})
    glyphs, order = font.getGlyphSet(), font.getGlyphOrder()
    pen = SVGPathPen(glyphs, ntos=n)
    x = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions, strict=True):
        glyphs[order[info.codepoint]].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, 0)))
        x += pos.x_advance
    return pen.getCommands(), x, font["OS/2"].sCapHeight


def banner(c: dict[str, str], words: list[tuple[str, str]], width: float,
           tagline: tuple[str, float, float], title: str) -> str:
    """The lockup with the tagline under it, set to the lockup's width and centred."""
    x0, y0, x1, y1 = MARK_BOX
    baseline = (y0 + y1) / 2 + CAP_HEIGHT / 2
    tx = x1 + GAP
    paths = "".join(f'<path id="wordmark-{k}" fill="{c[k]}" d="{d}"/>' for k, d in words)
    vw = tx + width - x0
    d, advance, cap = tagline
    scale = vw / advance
    tag_base = y1 + TAGLINE_GAP + cap * scale
    descent = 0.25 * cap * scale  # room for g and y below the baseline
    body = (
        mark_group(c)
        + f'<g id="wordmark" transform="translate({n(tx)} {n(baseline)})">{paths}</g>'
        + f'<path id="tagline" fill="{c["uni"]}" '
        f'transform="translate({n(x0)} {n(tag_base)}) scale({n(scale)})" d="{d}"/>'
    )
    vh = tag_base + descent - y0
    return svg(f"{n(x0)} {y0} {n(vw)} {n(vh)}", title, body, n(vw / 4), n(vh / 4))


def lockup(c: dict[str, str], words: list[tuple[str, str]], width: float, title: str) -> str:
    x0, y0, x1, y1 = MARK_BOX
    baseline = (y0 + y1) / 2 + CAP_HEIGHT / 2  # cap height centred on the mark
    tx = x1 + GAP
    paths = "".join(
        f'<path id="wordmark-{k}" fill="{c[k]}" d="{d}"/>' for k, d in words
    )
    body = mark_group(c) + f'<g id="wordmark" transform="translate({n(tx)} {n(baseline)})">{paths}</g>'
    right = tx + width
    vw, vh = right - x0, y1 - y0
    return svg(f"{n(x0)} {y0} {n(vw)} {vh}", title, body, n(vw / 4), n(vh / 4))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--font", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--only", nargs="*", help="write only these file names (masters are append-only)")
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)

    words, width, _ = wordmark_paths(a.font)
    tagline = text_path(a.font, TAGLINE, TAGLINE_AXES)
    dots16 = "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in DOTS16)
    files = {
        "unichef-mark.svg": svg("0 0 1024 1024", "UniChef", mark_group(DARK), "1024", "1024"),
        "unichef-mark-light.svg": svg("0 0 1024 1024", "UniChef", mark_group(LIGHT), "1024", "1024"),
        "unichef-mark-mono.svg": svg("0 0 1024 1024", "UniChef", mark_group(MONO), "1024", "1024"),
        "unichef-mark-maskable.svg": svg(
            "0 0 1024 1024", "UniChef",
            f'<rect id="background" width="1024" height="1024" fill="{SURFACE}"/>'
            + mark_group(DARK, "translate(512 512) scale(0.8) translate(-512 -512)"),
            "1024", "1024",
        ),
        "unichef-mark-16.svg": svg(
            "0 0 16 16", "UniChef",
            f'<g id="mark"><path id="mark-u" fill="{DARK["mark"]}" d="{U16_PATH}"/>'
            f'<g id="mark-dots" fill="{DARK["dots"]}">{dots16}</g></g>',
            "16", "16",
        ),
        "unichef-logo.svg": lockup(DARK, words, width, "UniChef"),
        "unichef-logo-light.svg": lockup(LIGHT, words, width, "UniChef"),
        "unichef-logo-mono.svg": lockup(MONO, words, width, "UniChef"),
        "unichef-banner.svg": banner(DARK, words, width, tagline, f"UniChef: {TAGLINE}"),
        "unichef-banner-light.svg": banner(LIGHT, words, width, tagline, f"UniChef: {TAGLINE}"),
    }
    for name, text in files.items():
        if a.only and name not in a.only:
            continue
        (a.out / name).write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote {a.out / name}")


if __name__ == "__main__":
    main()
