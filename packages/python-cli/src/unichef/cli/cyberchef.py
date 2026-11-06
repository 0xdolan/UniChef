# SPDX-License-Identifier: GPL-3.0-or-later
"""Import a CyberChef recipe (JSON or "chef" format) as a UniChef recipe (PRD §5.3).

The translation table is ``spec/cyberchef-map.json``; a copy ships in ``unichef._data``."""

import json
import re
from functools import cache
from importlib.resources import files
from typing import Any, cast

from unichef.core.dish import JsonValue
from unichef.core.errors import UniChefError

_ESCAPES = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\", "0": "\0"}
_BYTES_OPTIONS = {"Hex": "hex", "UTF8": "utf8", "Base64": "base64", "Latin1": "latin1"}

type Translator = dict[str, Any]


@cache
def table() -> dict[str, Any]:
    raw = (files("unichef._data") / "cyberchef-map.json").read_text(encoding="utf-8")
    return cast(dict[str, Any], json.loads(raw))


def _bad(message: str) -> UniChefError:
    return UniChefError("E_ARG_INVALID", message)


# -- chef format ---------------------------------------------------------------------------


class _Chef:
    """A small parser for CyberChef's ``Op_Name(arg,...)/disabled/breakpoint`` format, whose
    arguments are JavaScript literals."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.pos = 0

    def fail(self, what: str) -> UniChefError:
        return UniChefError("E_RECIPE_SCHEMA", f"Chef recipe: {what} at offset {self.pos}.")

    def skip(self) -> None:
        while self.pos < len(self.text) and self.text[self.pos].isspace():
            self.pos += 1

    def peek(self) -> str:
        self.skip()
        return self.text[self.pos : self.pos + 1]

    def eat(self, char: str) -> None:
        if self.peek() != char:
            raise self.fail(f"expected {char!r}")
        self.pos += 1

    def steps(self) -> list[dict[str, JsonValue]]:
        out: list[dict[str, JsonValue]] = []
        while self.peek():
            match = re.compile(r"[A-Za-z0-9_\-/.+]+?(?=\()").match(self.text, self.pos)
            if not match:
                raise self.fail("expected an operation name")
            self.pos = match.end()
            step: dict[str, JsonValue] = {"op": match.group().replace("_", " ")}
            self.eat("(")
            args: list[JsonValue] = []
            while self.peek() != ")":
                args.append(self.value())
                if self.peek() == ",":
                    self.pos += 1
            self.eat(")")
            step["args"] = args
            for flag in ("disabled", "breakpoint"):
                if self.text.startswith("/" + flag, self.pos):
                    step[flag] = True
                    self.pos += len(flag) + 1
            out.append(step)
        return out

    def value(self) -> JsonValue:
        char = self.peek()
        if char in {"'", '"'}:
            return self.string()
        if char == "[":
            self.pos += 1
            items: list[JsonValue] = []
            while self.peek() != "]":
                items.append(self.value())
                if self.peek() == ",":
                    self.pos += 1
            self.eat("]")
            return items
        if char == "{":
            self.pos += 1
            obj: dict[str, JsonValue] = {}
            while self.peek() != "}":
                key = self.string() if self.peek() in {"'", '"'} else self.word()
                self.eat(":")
                obj[key] = self.value()
                if self.peek() == ",":
                    self.pos += 1
            self.eat("}")
            return obj
        word = self.word()
        literals: dict[str, JsonValue] = {"true": True, "false": False, "null": None}
        if word in literals:
            return literals[word]
        try:
            number = float(word)
        except ValueError:
            raise self.fail(f"unexpected {word!r}") from None
        return int(number) if number.is_integer() and "." not in word else number

    def word(self) -> str:
        match = re.compile(r"[A-Za-z0-9_$.+\-]+").match(self.text, self.pos)
        if not match:
            raise self.fail("expected a value")
        self.pos = match.end()
        return match.group()

    def string(self) -> str:
        quote = self.text[self.pos]
        self.pos += 1
        out: list[str] = []
        while self.pos < len(self.text):
            char = self.text[self.pos]
            self.pos += 1
            if char == quote:
                return "".join(out)
            if char == "\\" and self.pos < len(self.text):
                nxt = self.text[self.pos]
                self.pos += 1
                if nxt == "u" and re.fullmatch(
                    r"[0-9a-fA-F]{4}", self.text[self.pos : self.pos + 4]
                ):
                    out.append(chr(int(self.text[self.pos : self.pos + 4], 16)))
                    self.pos += 4
                elif nxt == "x" and re.fullmatch(
                    r"[0-9a-fA-F]{2}", self.text[self.pos : self.pos + 2]
                ):
                    out.append(chr(int(self.text[self.pos : self.pos + 2], 16)))
                    self.pos += 2
                else:
                    out.append(_ESCAPES.get(nxt, nxt))
            else:
                out.append(char)
        raise self.fail("unterminated string")


def parse(text: str) -> list[dict[str, JsonValue]]:
    """CyberChef steps as ``[{"op": name, "args": [...], ...}]``, from either format."""
    stripped = text.strip()
    if stripped.startswith("["):
        try:
            doc = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise UniChefError("E_RECIPE_SCHEMA", f"Invalid CyberChef JSON: {exc.msg}.") from None
        if not all(isinstance(s, dict) and isinstance(s.get("op"), str) for s in doc):
            raise UniChefError("E_RECIPE_SCHEMA", 'Each CyberChef step needs an "op" name.')
        return cast(list[dict[str, JsonValue]], doc)
    if not stripped:
        raise UniChefError("E_RECIPE_SCHEMA", "The CyberChef recipe is empty.")
    return _Chef(stripped).steps()


# -- translation ---------------------------------------------------------------------------


def _unescape(text: str) -> str:
    return re.sub(r"\\(.)", lambda m: _ESCAPES.get(m.group(1), m.group(0)), text)


def _key(value: object) -> str:
    return value if isinstance(value, str) else json.dumps(value)


def _fill(template: object, value: object) -> object:
    if template == "$":
        return value
    if isinstance(template, dict):
        return {k: _fill(v, value) for k, v in template.items()}
    return template


class _Step:
    def __init__(self, op: str, preset: dict[str, Any]) -> None:
        self.op = op
        self.args: dict[str, Any] = dict(preset)
        self.flags = ""
        self.before: list[dict[str, Any]] = []
        self.after: list[dict[str, Any]] = []


def _toggle(name: str, value: object, encoding: str | None) -> dict[str, str]:
    if encoding is not None and isinstance(value, str):
        return {"encoding": encoding, "value": value}
    if isinstance(value, dict) and isinstance(value.get("string"), str):
        enc = _BYTES_OPTIONS.get(str(value.get("option")))
        if enc is None:
            raise _bad(f"{name}: unsupported key format {value.get('option')!r}.")
        return {"encoding": enc, "value": value["string"]}
    raise _bad(f"{name}: expected a {{option, string}} value.")


def _find(where: str, tr: Translator, value: object, step: _Step) -> None:
    """Find / Replace's ``{option, string}``: Regex, Extended (escapes) or Simple string."""
    if not isinstance(value, dict) or not isinstance(value.get("string"), str):
        raise _bad(f"{where}: expected a {{option, string}} value.")
    option = str(value.get("option", "Regex"))
    extended = option.startswith("Extended")
    step.args["literal"] = extended or option == "Simple string"
    step.args[tr["to"]] = _unescape(value["string"]) if extended else value["string"]


def _mapped(where: str, tr: Translator, value: object, step: _Step) -> None:
    mapping = tr["map"]
    key = _key(value)
    if key not in mapping and "*" not in mapping:
        raise _bad(f"{where}: {value!r} has no UniChef equivalent.")
    target = mapping.get(key, mapping.get("*"))
    if not isinstance(target, dict):
        step.args[tr["to"]] = _fill(target, value)
        return
    if "value" in target:
        step.args[tr["to"]] = _fill(target["value"], value)
    step.args.update({k: _fill(v, value) for k, v in target.get("set", {}).items()})
    step.before += target.get("before", [])
    step.after += target.get("after", [])


def _check(where: str, tr: Translator, value: object, step: _Step) -> bool:
    """Arguments that set nothing directly: ignored, expected constants and regex flags.
    Returns whether ``tr`` was one of them."""
    if tr.get("ignore"):
        return True
    if "expect" in tr:
        if value != tr["expect"]:
            raise _bad(f"{where}: only {tr['expect']!r} can be imported, not {value!r}.")
        return True
    if "flag" in tr:
        if value == tr.get("when", True):
            step.flags += tr["flag"]
        return True
    return False


def _apply(name: str, index: int, tr: Translator, value: object, step: _Step) -> None:
    where = f"{name} argument {index + 1}"
    if _check(where, tr, value, step):
        return
    if "extract" in tr and isinstance(value, str):
        found = re.search(tr["extract"], value)
        value = found.group(1) if found else value
    if tr.get("find"):
        _find(where, tr, value, step)
        return
    if "bytes" in tr:
        encoding = tr["bytes"] if isinstance(tr["bytes"], str) else None
        step.args[tr["to"]] = _toggle(where, value, encoding)
        return
    if "map" in tr:
        _mapped(where, tr, value, step)
        return
    if tr.get("integer"):
        try:
            number = int(cast(Any, value))
        except (TypeError, ValueError):
            raise _bad(f"{where}: expected a number, not {value!r}.") from None
        divide = int(tr.get("divide", 1))
        if number % divide:
            raise _bad(f"{where}: {number} is not a multiple of {divide}.")
        value = number // divide
    elif tr.get("unescape") and isinstance(value, str):
        value = _unescape(value)
    elif tr.get("invert") and isinstance(value, bool):
        value = not value
    step.args[tr["to"]] = value


def _translate(cc: dict[str, JsonValue], entry: dict[str, Any]) -> list[dict[str, Any]]:
    name = str(cc["op"])
    values = cc.get("args", [])
    if not isinstance(values, list):
        raise UniChefError("E_RECIPE_SCHEMA", f'{name}: "args" must be an array.')
    translators: list[Translator] = entry["args"]
    if len(values) > len(translators):
        raise _bad(f"{name}: expected at most {len(translators)} argument(s), got {len(values)}.")
    step = _Step(entry["op"], entry.get("set", {}))
    for index, value in enumerate(values):
        _apply(name, index, translators[index], value, step)
    if step.flags:
        step.args["flags"] = "".join(sorted(set(step.flags)))
    out: dict[str, Any] = {"op": step.op}
    if step.args:
        out["args"] = step.args
    for flag in ("disabled", "breakpoint"):
        if cc.get(flag) is True:
            out[flag] = True
    return [*step.before, out, *step.after]


def import_recipe(text: str) -> JsonValue:
    """Translate CyberChef recipe text into a UniChef recipe document."""
    steps = parse(text)
    operations: dict[str, Any] = table()["operations"]
    unknown = sorted({str(s["op"]) for s in steps if s["op"] not in operations})
    if unknown:
        raise UniChefError(
            "E_OP_UNKNOWN",
            "No UniChef equivalent for CyberChef operation(s): " + ", ".join(unknown) + ".",
            detail={"operations": unknown},
        )
    root: list[dict[str, Any]] = []
    scopes: list[list[dict[str, Any]]] = [root]
    for cc in steps:
        entry = operations[str(cc["op"])]
        if entry.get("merge"):
            del scopes[1:]
            continue
        translated = _translate(cc, entry)
        scopes[-1].extend(translated)
        if entry.get("scope"):
            main = next(s for s in translated if s["op"] == entry["op"])
            main.setdefault("args", {})["steps"] = []
            scopes.append(main["args"]["steps"])
    return cast(JsonValue, {"version": 1, "steps": root})
