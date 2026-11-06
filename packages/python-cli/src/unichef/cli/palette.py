# SPDX-License-Identifier: GPL-3.0-or-later
"""The CLI colour palette (PRD §5.5). Rich downgrades the hex colours to 256 or 16 colours."""

from typing import Literal

from rich.theme import Theme

type ThemeName = Literal["dark", "light", "mono"]
THEMES: tuple[ThemeName, ...] = ("dark", "light", "mono")

_DARK = {
    "brand.primary": "#8B7CF6",
    "brand.accent": "#F5A524",
    "text": "#E6E8EE",
    "muted": "#8A93A6",
    "cp": "#22D3EE",
    "ok": "#34D399",
    "warn": "#FBBF24",
    "error": "#F87171",
    "flag.security": "#FB7185 on #3B0A16",
}

_LIGHT = {
    "brand.primary": "#5B4BD8",
    "brand.accent": "#B26B00",
    "text": "#1B1F2A",
    "muted": "#5E6678",
    "cp": "#0E7490",
    "ok": "#047857",
    "warn": "#A16207",
    "error": "#B91C1C",
    "flag.security": "#9F1239 on #FFE4E6",
}

# The mono theme uses only bold, italic and underline.
_MONO = {
    "brand.primary": "bold",
    "brand.accent": "bold",
    "text": "none",
    "muted": "italic",
    "cp": "underline",
    "ok": "bold",
    "warn": "bold",
    "error": "bold underline",
    "flag.security": "bold underline",
}

_STYLES: dict[ThemeName, dict[str, str]] = {"dark": _DARK, "light": _LIGHT, "mono": _MONO}


def theme(name: ThemeName) -> Theme:
    """The Rich theme for ``name``, layered over Rich's defaults."""
    return Theme(_STYLES[name])
