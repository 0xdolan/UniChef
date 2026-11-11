# SPDX-License-Identifier: GPL-3.0-or-later
"""Version mapping and the files that carry the project version (PRD §8.4, §10.5).

Shared by sync.py (write) and check.py (verify). ``VERSION`` holds the SemVer string;
every other target is derived from it. A target whose file does not exist yet (the web
app, the extensions) is skipped, so the list can name files before they are created.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION_FILE = ROOT / "VERSION"

# Same grammar as the release/hotfix branch names (PRD §10.1), without leading zeros.
_NUM = r"(0|[1-9]\d*)"
SEMVER = re.compile(rf"^{_NUM}\.{_NUM}\.{_NUM}(?:-(alpha|beta|rc)\.{_NUM})?$")
_PEP440_TAG = {"alpha": "a", "beta": "b", "rc": "rc"}
# Chrome and Firefox manifest versions: up to four dot-separated integers, each ≤ 65535.
_EXT_PART_MAX = 65535
_EXT_PATCH_FILL = 99


class VersionError(ValueError):
    pass


@dataclass(slots=True, frozen=True)
class Version:
    major: int
    minor: int
    patch: int
    pre: str | None = None  # "alpha", "beta" or "rc"
    pre_n: int = 0

    @classmethod
    def parse(cls, text: str) -> "Version":
        m = SEMVER.match(text.strip())
        if m is None:
            raise VersionError(
                f"{text.strip()!r} is not X.Y.Z or X.Y.Z-(alpha|beta|rc).N (no leading zeros)."
            )
        major, minor, patch, pre, pre_n = m.groups()
        return cls(int(major), int(minor), int(patch), pre, int(pre_n or 0))

    @property
    def core(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"

    @property
    def semver(self) -> str:
        return self.core if self.pre is None else f"{self.core}-{self.pre}.{self.pre_n}"

    @property
    def npm(self) -> str:
        return self.semver

    @property
    def pep440(self) -> str:
        return self.core if self.pre is None else f"{self.core}{_PEP440_TAG[self.pre]}{self.pre_n}"

    @property
    def debian(self) -> str:
        """Debian upstream version: ``~`` sorts a pre-release before the release."""
        return self.core if self.pre is None else f"{self.core}~{self.pre}{self.pre_n}"

    @property
    def extension(self) -> str:
        """Manifest ``version``: a pre-release of X.Y.Z sorts just below X.Y.Z.

        X.Y.Z (Z > 0) -> X.Y.(Z-1).N, X.Y.0 -> X.(Y-1).99.N, X.0.0 -> (X-1).99.99.N.
        """
        if self.pre is None:
            parts = [self.major, self.minor, self.patch]
        elif self.patch > 0:
            parts = [self.major, self.minor, self.patch - 1, self.pre_n]
        elif self.minor > 0:
            parts = [self.major, self.minor - 1, _EXT_PATCH_FILL, self.pre_n]
        elif self.major > 0:
            parts = [self.major - 1, _EXT_PATCH_FILL, _EXT_PATCH_FILL, self.pre_n]
        else:
            raise VersionError(f"{self.semver} has no extension version below it.")
        if self.pre is not None and self.pre_n < 1:
            raise VersionError(f"{self.semver}: extension pre-release numbers start at 1.")
        if any(p > _EXT_PART_MAX for p in parts):
            raise VersionError(f"{self.semver}: extension version parts must be ≤ 65535.")
        return ".".join(map(str, parts))


def read_version() -> Version:
    return Version.parse(VERSION_FILE.read_text(encoding="utf-8"))


@dataclass(slots=True, frozen=True)
class Field:
    """One version value inside a file: ``pattern`` has a single group around the value."""

    pattern: re.Pattern[str]
    expected: Callable[[Version], str]


@dataclass(slots=True, frozen=True)
class Target:
    path: str  # relative to ROOT
    fields: tuple[Field, ...]

    @property
    def file(self) -> Path:
        return ROOT / self.path

    def read(self) -> list[str | None]:
        text = self.file.read_text(encoding="utf-8")
        found = []
        for f in self.fields:
            m = f.pattern.search(text)
            found.append(None if m is None else m.group(1))
        return found

    def write(self, v: Version) -> bool:
        """Rewrite each field in place. Returns whether the file changed."""
        text = self.file.read_text(encoding="utf-8")
        new = text
        for f in self.fields:
            m = f.pattern.search(new)
            if m is None:
                raise VersionError(f"{self.path}: no match for {f.pattern.pattern!r}.")
            new = new[: m.start(1)] + f.expected(v) + new[m.end(1) :]
        if new != text:
            self.file.write_text(new, encoding="utf-8")
        return new != text


def _json_key(key: str) -> re.Pattern[str]:
    # A top-level key in a two-space-indented JSON file, as Prettier writes them.
    return re.compile(rf'^  "{key}": "([^"]*)"', re.MULTILINE)


def _package_json(path: str) -> Target:
    return Target(path, (Field(_json_key("version"), lambda v: v.npm),))


TARGETS: tuple[Target, ...] = (
    Target(
        "VERSION",
        (Field(re.compile(r"\A(.*?)\n?\Z", re.DOTALL), lambda v: v.semver),),
    ),
    Target(
        "packages/python-cli/src/unichef/__init__.py",
        (Field(re.compile(r'^__version__ = "([^"]*)"', re.MULTILINE), lambda v: v.pep440),),
    ),
    _package_json("packages/npm-core/package.json"),
    Target(
        "packages/npm-core/src/version.ts",
        (Field(re.compile(r"^export const VERSION = '([^']*)';", re.MULTILINE), lambda v: v.npm),),
    ),
    _package_json("clients/web/package.json"),
    _package_json("clients/extensions/common/package.json"),
    Target(
        "clients/extensions/common/manifest.base.json",
        (
            Field(_json_key("version"), lambda v: v.extension),
            Field(_json_key("version_name"), lambda v: v.semver),
        ),
    ),
    # The top entry's upstream version; PPA uploads add their suffix at build time (PRD §8.5).
    Target(
        "debian/changelog",
        (Field(re.compile(r"\Aunichef \(([^)]*)-1\)"), lambda v: v.debian),),
    ),
)


def existing_targets() -> list[Target]:
    return [t for t in TARGETS if t.file.exists()]


def missing_targets() -> list[Target]:
    return [t for t in TARGETS if not t.file.exists()]
