# SPDX-License-Identifier: GPL-3.0-or-later
"""Tests for the version mapping and propagation (PRD §8.4, §10.5).

uv run --with pytest==9.2.0 pytest scripts
"""

import shutil
from pathlib import Path

import pytest
import versions
from sync import promote_changelog
from versions import TARGETS, Version, VersionError


@pytest.mark.parametrize(
    ("semver", "pep440", "debian", "extension"),
    [  # the PRD §8.4 table, plus patch-level and major pre-releases
        ("0.3.0-alpha.2", "0.3.0a2", "0.3.0~alpha2", "0.2.99.2"),
        ("0.6.0-beta.1", "0.6.0b1", "0.6.0~beta1", "0.5.99.1"),
        ("1.0.0-rc.3", "1.0.0rc3", "1.0.0~rc3", "0.99.99.3"),
        ("1.0.0", "1.0.0", "1.0.0", "1.0.0"),
        ("1.2.3-rc.1", "1.2.3rc1", "1.2.3~rc1", "1.2.2.1"),
        ("2.0.0-beta.4", "2.0.0b4", "2.0.0~beta4", "1.99.99.4"),
    ],
)
def test_rel_001_version_mapping(semver: str, pep440: str, debian: str, extension: str) -> None:
    """REL-001: one SemVer maps to the PyPI, npm, Debian and extension forms."""
    v = Version.parse(semver)
    assert (v.semver, v.npm, v.pep440, v.debian, v.extension) == (
        semver,
        semver,
        pep440,
        debian,
        extension,
    )


@pytest.mark.parametrize(
    "text", ["1.0", "01.0.0", "1.0.0-dev.1", "1.0.0-rc", "v1.0.0", "1.0.0-rc.01"]
)
def test_rejects_malformed_versions(text: str) -> None:
    with pytest.raises(VersionError):
        Version.parse(text)


@pytest.mark.parametrize("text", ["0.0.0-alpha.1", "1.0.0-rc.0", "70000.0.0", "1.0.0-rc.70000"])
def test_rejects_unrepresentable_extension_versions(text: str) -> None:
    with pytest.raises(VersionError):
        _ = Version.parse(text).extension


def test_repository_targets_agree_with_version_file() -> None:
    v = versions.read_version()
    for t in versions.existing_targets():
        assert t.read() == [f.expected(v) for f in t.fields], t.path


def test_write_updates_every_field(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    for t in versions.existing_targets():
        dest = tmp_path / t.path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(t.file, dest)
    # The real extension manifest is copied above; it must be one of the targets.
    manifest = tmp_path / "clients/extensions/common/manifest.base.json"
    assert manifest.exists()
    monkeypatch.setattr(versions, "ROOT", tmp_path)

    v = Version.parse("0.5.0-beta.2")
    written = [t for t in TARGETS if t.file.exists()]
    assert all(t.write(v) for t in written)
    assert not any(t.write(v) for t in written)  # idempotent
    for t in written:
        assert t.read() == [f.expected(v) for f in t.fields], t.path
    assert (tmp_path / "VERSION").read_text(encoding="utf-8") == "0.5.0-beta.2\n"
    assert '"version": "0.4.99.2"' in manifest.read_text(encoding="utf-8")


def test_promote_changelog() -> None:
    text = "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- x\n"
    out = promote_changelog(text, "0.2.0", "2026-12-01")
    assert out == "# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-12-01\n\n### Added\n\n- x\n"
    assert promote_changelog(out, "0.2.0", "2026-12-02") == out
    with pytest.raises(VersionError):
        promote_changelog("# Changelog\n", "0.2.0", "2026-12-01")
