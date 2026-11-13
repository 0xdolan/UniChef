# SPDX-License-Identifier: GPL-3.0-or-later
"""Letter codes: Morse, NATO, Braille, A1Z26, Bacon, leet speak and ROT8000 (PRD §3.8, 1.1).

Behaviour follows CyberChef v11.5.0 (Apache-2.0), with the deviations listed in
spec/README.md: only ASCII letters are case-mapped, and text is handled per code point
rather than per UTF-16 code unit.
"""

import functools
import re

from unichef.core.errors import UniChefError
from unichef.core.registry import Args, Example, OpContext, bool_arg, enum_arg, operation

CHECK_EVERY = 4096
# JavaScript's \s: White_Space plus U+FEFF, without U+0085.
_JS_SPACE = r"\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_ASCII_SPACE = " \t\n\v\f\r"

_DELIMITERS = {
    "space": " ",
    "newline": "\n",
    "crlf": "\r\n",
    "slash": "/",
    "backslash": "\\",
    "comma": ",",
    "semicolon": ";",
    "colon": ":",
}
_LETTER_DELIMITERS = (
    "space",
    "newline",
    "crlf",
    "slash",
    "backslash",
    "comma",
    "semicolon",
    "colon",
)
_WORD_DELIMITERS = ("newline", "crlf", "slash", "backslash", "comma", "semicolon", "colon")
_A1Z26_DELIMITERS = ("space", "comma", "semicolon", "colon", "newline", "crlf")


def _ascii_upper(ch: str) -> str:
    return chr(ord(ch) - 32) if "a" <= ch <= "z" else ch


def _is_ascii_letter(ch: str) -> bool:
    return "A" <= ch <= "Z" or "a" <= ch <= "z"


# ---------------------------------------------------------------------------
# Morse code

# "-" is a dash and "." a dot; the format arg picks the symbols written.
_MORSE = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.", "G": "--.",
    "H": "....", "I": "..", "J": ".---", "K": "-.-", "L": ".-..", "M": "--", "N": "-.",
    "O": "---", "P": ".--.", "Q": "--.-", "R": ".-.", "S": "...", "T": "-", "U": "..-",
    "V": "...-", "W": ".--", "X": "-..-", "Y": "-.--", "Z": "--..",
    "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....",
    "6": "-....", "7": "--...", "8": "---..", "9": "----.", "0": "-----",
    ".": ".-.-.-", ",": "--..--", ":": "---...", ";": "-.-.-.", "!": "-.-.--",
    "?": "..--..", "'": ".----.", '"': ".-..-.", "/": "-..-.", "-": "-....-",
    "+": ".-.-.", "(": "-.--.", ")": "-.--.-", "@": ".--.-.", "=": "-...-",
    "&": ".-...", "_": "..--.-", "$": "...-..-", " ": ".......",
}  # fmt: skip
_MORSE_REVERSE = {code: letter for letter, code in _MORSE.items()}
_MORSE_FORMATS = ("-/.", "_/.", "Dash/Dot", "DASH/DOT", "dash/dot")
_MORSE_DASH = re.compile("-|\u2010|\u2212|_|\u2013|\u2014|dash", re.IGNORECASE | re.ASCII)
_MORSE_DOT = re.compile("\\.|\u00b7|dot", re.IGNORECASE | re.ASCII)


@operation(
    "to-morse-code",
    "To Morse code",
    "Encoding",
    "string",
    "string",
    (
        enum_arg("format", _MORSE_FORMATS),
        enum_arg("letter_delimiter", _LETTER_DELIMITERS),
        enum_arg("word_delimiter", _WORD_DELIMITERS),
    ),
    examples=(Example("SOS", {}, "... --- ..."),),
)
def to_morse_code(text: str, args: Args, ctx: OpContext) -> str:
    """Write each character as International Morse code. Letters are joined by
    `letter_delimiter` and words (split on runs of spaces) by `word_delimiter`; lines stay
    on their own lines. A character with no code is written as nothing but still gets
    its delimiters."""
    dash, dot = args.text("format").split("/")
    letter_delim = _DELIMITERS[args.text("letter_delimiter")]
    word_delim = _DELIMITERS[args.text("word_delimiter")]
    symbols = {"-": dash, ".": dot}
    out_lines: list[str] = []
    for line in re.split(r"\r?\n", text):
        words: list[str] = []
        for word in re.split(r" +", line):
            ctx.check()
            codes = (_MORSE.get(_ascii_upper(ch), "") for ch in word)
            words.append(letter_delim.join("".join(symbols[s] for s in code) for code in codes))
        out_lines.append(word_delim.join(words))
    return "\n".join(out_lines)


@operation(
    "from-morse-code",
    "From Morse code",
    "Encoding",
    "string",
    "string",
    (
        enum_arg("letter_delimiter", _LETTER_DELIMITERS),
        enum_arg("word_delimiter", _WORD_DELIMITERS),
    ),
    examples=(Example("... --- ...", {}, "SOS"),),
)
def from_morse_code(text: str, args: Args, ctx: OpContext) -> str:
    """Read International Morse code. Dashes may be `-`, `_`, hyphens, en or em dashes or
    the word `dash`; dots may be `.`, `·` or the word `dot`. Words are split on
    `word_delimiter` and joined with a space; a code that is not in the table is dropped."""
    ctx.check()
    text = _MORSE_DOT.sub(".", _MORSE_DASH.sub("-", text))
    letter_delim = _DELIMITERS[args.text("letter_delimiter")]
    word_delim = _DELIMITERS[args.text("word_delimiter")]
    return " ".join(
        "".join(_MORSE_REVERSE.get(code, "") for code in word.split(letter_delim))
        for word in text.split(word_delim)
    )


# ---------------------------------------------------------------------------
# NATO phonetic alphabet

_NATO = {
    "A": "Alfa", "B": "Bravo", "C": "Charlie", "D": "Delta", "E": "Echo", "F": "Foxtrot",
    "G": "Golf", "H": "Hotel", "I": "India", "J": "Juliett", "K": "Kilo", "L": "Lima",
    "M": "Mike", "N": "November", "O": "Oscar", "P": "Papa", "Q": "Quebec", "R": "Romeo",
    "S": "Sierra", "T": "Tango", "U": "Uniform", "V": "Victor", "W": "Whiskey", "X": "X-ray",
    "Y": "Yankee", "Z": "Zulu", "0": "Zero", "1": "One", "2": "Two", "3": "Three",
    "4": "Four", "5": "Five", "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine",
    ",": "Comma", "/": "Fraction bar", ".": "Full stop",
}  # fmt: skip
_NATO_CHARS = re.compile(r"[A-Za-z0-9,/.]")


@operation(
    "to-nato-alphabet",
    "To NATO alphabet",
    "Encoding",
    "string",
    "string",
    (),
    examples=(Example("Hi 5", {}, "Hotel India  Five "),),
)
def to_nato_alphabet(text: str, _args: Args, _ctx: OpContext) -> str:
    """Replace each ASCII letter, digit, `,`, `/` and `.` with its NATO spelling word and
    a space. Other characters are copied."""
    return _NATO_CHARS.sub(lambda m: _NATO[_ascii_upper(m.group())] + " ", text)


# ---------------------------------------------------------------------------
# Braille

_BRAILLE_ASCII = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)="
_BRAILLE_BASE = 0x2800


@operation(
    "to-braille",
    "To Braille",
    "Encoding",
    "string",
    "string",
    (),
    examples=(Example("Hi!", {}, "\u2813\u280a\u282e"),),
)
def to_braille(text: str, _args: Args, ctx: OpContext) -> str:
    """Replace each character of North American Braille ASCII (space, ASCII letters in
    either case, digits and `!"#$%&'()*+,-./:;<=>?@[\\]^_`) with its six-dot Braille
    pattern, U+2800 to U+283F. Other characters are copied."""
    out: list[str] = []
    for i, ch in enumerate(text):
        if i % CHECK_EVERY == 0:
            ctx.check()
        idx = _BRAILLE_ASCII.find(_ascii_upper(ch))
        out.append(chr(_BRAILLE_BASE + idx) if idx >= 0 else ch)
    return "".join(out)


@operation(
    "from-braille",
    "From Braille",
    "Encoding",
    "string",
    "string",
    (),
    examples=(Example("\u2813\u280a\u282e", {}, "HI!"),),
)
def from_braille(text: str, _args: Args, ctx: OpContext) -> str:
    """Replace each six-dot Braille pattern (U+2800 to U+283F) with its North American
    Braille ASCII character; letters come out in upper case. Other characters are
    copied."""
    out: list[str] = []
    for i, ch in enumerate(text):
        if i % CHECK_EVERY == 0:
            ctx.check()
        cp = ord(ch) - _BRAILLE_BASE
        out.append(_BRAILLE_ASCII[cp] if 0 <= cp < len(_BRAILLE_ASCII) else ch)
    return "".join(out)


# ---------------------------------------------------------------------------
# A1Z26

_ALPHABET_SIZE = 26
_A1Z26_PIECE = re.compile(r"[0-9]+")


@operation(
    "a1z26-encode",
    "A1Z26 encode",
    "Crypto",
    "string",
    "string",
    (enum_arg("delimiter", _A1Z26_DELIMITERS),),
    examples=(Example("Hello", {}, "8 5 12 12 15"),),
)
def a1z26_encode(text: str, args: Args, _ctx: OpContext) -> str:
    """Write each ASCII letter as its place in the alphabet (`a` and `A` are 1, `z` and
    `Z` are 26), joined by `delimiter`. Other characters are dropped."""
    delim = _DELIMITERS[args.text("delimiter")]
    return delim.join(str((ord(ch) | 32) - 96) for ch in text if _is_ascii_letter(ch))


@operation(
    "a1z26-decode",
    "A1Z26 decode",
    "Crypto",
    "string",
    "string",
    (enum_arg("delimiter", _A1Z26_DELIMITERS),),
    examples=(Example("8 5 12 12 15", {}, "hello"),),
)
def a1z26_decode(text: str, args: Args, ctx: OpContext) -> str:
    """Split on `delimiter` and write each number from 1 to 26 as a lower-case letter.
    Spaces, tabs and line breaks around a number are ignored. Anything else is
    `E_DECODE`."""
    if not text:
        return ""
    out: list[str] = []
    for i, piece in enumerate(text.split(_DELIMITERS[args.text("delimiter")])):
        if i % CHECK_EVERY == 0:
            ctx.check()
        digits = piece.strip(_ASCII_SPACE)
        if not _A1Z26_PIECE.fullmatch(digits) or not 1 <= int(digits) <= _ALPHABET_SIZE:
            raise UniChefError("E_DECODE", f"Number {i + 1} is not between 1 and 26.")
        out.append(chr(int(digits) + 96))
    return "".join(out)


# ---------------------------------------------------------------------------
# Bacon cipher

_BACON_ALPHABETS = {
    # I and J share a code, as do U and V.
    "standard": "ABCDEFGHIKLMNOPQRSTUWXYZ",
    "complete": "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
}
_BACON_STANDARD_CODES = (0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                         19, 19, 20, 21, 22, 23)  # fmt: skip
_BACON_WORDS = re.compile(rf"[{_JS_SPACE}]+")


def _bacon_code(ch: str, alphabet: str, invert: bool, letters: str) -> str:
    n = ord(_ascii_upper(ch)) - 65
    if alphabet == "standard":
        n = _BACON_STANDARD_CODES[n]
    if invert:
        n ^= 0b11111
    return "".join(letters[n >> bit & 1] for bit in range(4, -1, -1))


@operation(
    "bacon-encode",
    "Bacon cipher encode",
    "Crypto",
    "string",
    "string",
    (
        enum_arg("alphabet", ("standard", "complete")),
        enum_arg("translation", ("01", "ab")),
        bool_arg("keep_other", False),
        bool_arg("invert", False),
    ),
    examples=(Example("Hi", {}, "00111 01000"),),
)
def bacon_encode(text: str, args: Args, ctx: OpContext) -> str:
    """Write each ASCII letter as a five-symbol Bacon code. The `standard` alphabet gives
    I and J one code, and U and V another; `complete` gives all 26 letters their own.
    Codes are written in `0`/`1` or `A`/`B` and joined by spaces, or, with `keep_other`,
    written in place among the other characters. `invert` swaps the two symbols."""
    alphabet = args.text("alphabet")
    letters = "01" if args.text("translation") == "01" else "AB"
    invert = args.flag("invert")
    keep = args.flag("keep_other")
    out: list[str] = []
    for i, ch in enumerate(text):
        if i % CHECK_EVERY == 0:
            ctx.check()
        if _is_ascii_letter(ch):
            out.append(_bacon_code(ch, alphabet, invert, letters))
        elif keep:
            out.append(ch)
    return "".join(out) if keep else " ".join(out)


def _bacon_bits(text: str, translation: str) -> str:
    if translation == "01":
        return "".join(ch for ch in text if ch in "01")
    if translation == "ab":
        return "".join("0" if ch in "Aa" else "1" for ch in text if ch in "AaBb")
    if translation == "case":
        return "".join("1" if ch <= "Z" else "0" for ch in text if _is_ascii_letter(ch))
    return "".join(
        "1" if _ascii_upper(word[0]) >= "N" else "0"
        for word in _BACON_WORDS.split(text)
        if word and _is_ascii_letter(word[0])
    )


@operation(
    "bacon-decode",
    "Bacon cipher decode",
    "Crypto",
    "string",
    "string",
    (
        enum_arg("alphabet", ("standard", "complete")),
        enum_arg("translation", ("01", "ab", "case", "first-letter")),
        bool_arg("invert", False),
    ),
    examples=(Example("00111 01000", {}, "HI"),),
)
def bacon_decode(text: str, args: Args, ctx: OpContext) -> str:
    """Read Bacon codes as upper-case letters. `01` reads `0` and `1`, `ab` reads `A` and
    `B` in either case, `case` reads lower-case ASCII letters as 0 and upper-case as 1,
    and `first-letter` reads each word starting with A to M as 0 and N to Z as 1. Other
    characters are skipped, every five symbols make a letter, and leftover symbols are
    ignored. A code past the end of the alphabet is written as `?`."""
    ctx.check()
    bits = _bacon_bits(text, args.text("translation"))
    alphabet = _BACON_ALPHABETS[args.text("alphabet")]
    invert = 0b11111 if args.flag("invert") else 0
    out: list[str] = []
    for start in range(0, len(bits) - 4, 5):
        n = int(bits[start : start + 5], 2) ^ invert
        out.append(alphabet[n] if n < len(alphabet) else "?")
    return "".join(out)


# ---------------------------------------------------------------------------
# Leet speak

_TO_LEET = {"a": "4", "e": "3", "i": "1", "o": "0", "s": "5", "t": "7"}
_FROM_LEET = {digit: letter for letter, digit in _TO_LEET.items()}


@operation(
    "leet-speak",
    "Leet speak",
    "Text",
    "string",
    "string",
    (enum_arg("direction", ("to", "from")),),
    examples=(Example("Leet speak", {}, "L337 5p34k"),),
)
def leet_speak(text: str, args: Args, _ctx: OpContext) -> str:
    """`to` replaces the ASCII letters a, e, i, o, s and t, in either case, with 4, 3, 1,
    0, 5 and 7. `from` replaces those digits with the lower-case letters. Other
    characters are copied."""
    if args.text("direction") == "to":
        return re.sub(r"[AEIOSTaeiost]", lambda m: _TO_LEET[m.group().lower()], text)
    return re.sub(r"[013457]", lambda m: _FROM_LEET[m.group()], text)


# ---------------------------------------------------------------------------
# ROT8000

# Rotated code points: the BMP without controls, spaces, surrogates and a few format
# characters. 63 404 code points, rotated by half.
_ROT8000_RANGES = (
    (0x21, 0x7E),
    (0xA1, 0x167F),
    (0x1681, 0x1FFF),
    (0x200B, 0x2027),
    (0x202A, 0x202E),
    (0x2030, 0x205E),
    (0x2060, 0x2FFF),
    (0x3001, 0xD7FF),
    (0xE000, 0xFFFF),
)


@functools.cache
def _rot8000() -> dict[int, int]:
    points = [cp for lo, hi in _ROT8000_RANGES for cp in range(lo, hi + 1)]
    half = len(points) // 2
    return {cp: points[(i + half) % len(points)] for i, cp in enumerate(points)}


@operation(
    "rot8000",
    "ROT8000",
    "Crypto",
    "string",
    "string",
    (),
    examples=(Example("Hello, World!", {}, "籑籮籵籵籸簵 籠籸类籵籭簪"),),
)
def rot8000(text: str, _args: Args, _ctx: OpContext) -> str:
    """Rotate visible Basic Multilingual Plane characters halfway through the list of
    63 404 that take part, so applying it twice gives the input back. Spaces, controls
    and characters outside the BMP are copied."""
    return text.translate(_rot8000())
