# SPDX-License-Identifier: GPL-3.0-or-later
"""Supply-chain and disclosure policy checks on the repository itself (PRD §5.3).

uv run --with pytest==9.2.0 pytest scripts
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = sorted((ROOT / ".github/workflows").glob("*.yml"))


def _lines(pattern: str) -> list[tuple[str, str]]:
    return [
        (f"{path.name}:{i}", line)
        for path in WORKFLOWS
        for i, line in enumerate(path.read_text("utf-8").splitlines(), 1)
        if re.search(pattern, line)
    ]


def test_actions_are_pinned_by_sha() -> None:
    """SEC-008: every third-party action is pinned to a full commit SHA, with its version."""
    loose = [
        where
        for where, line in _lines(r"^\s*(-\s+)?uses:")
        if not re.search(r"uses:\s*(\./|[\w.-]+/[\w./-]+@[0-9a-f]{40} # v\d)", line)
    ]
    assert loose == []


def test_installs_are_frozen() -> None:
    """SEC-008: CI installs exactly what the committed lockfiles say."""
    for lock in ("pnpm-lock.yaml", "packages/python-cli/uv.lock"):
        assert (ROOT / lock).is_file(), lock
    pnpm = _lines(r"\bpnpm (i|install)\b")
    assert pnpm
    assert [w for w, line in pnpm if "--frozen-lockfile" not in line] == []
    # Repo scripts are standalone (PEP 723) and pin their own dependencies.
    standalone = r"uv run (--with \S+ )?(scripts/|pytest scripts)"
    unlocked = [
        where
        for where, line in _lines(r"\buv (sync|run)\b")
        if "--locked" not in line and not re.search(standalone, line)
    ]
    assert unlocked == []
    assert [w for w, _ in _lines(r"\bnpm (ci|install)\b|\bpip install\b")] == []


def test_dependabot_codeql_and_attestations() -> None:
    """SEC-008: Dependabot watches every ecosystem; CodeQL runs; releases are attested and
    published with OIDC trusted publishing from signed tags."""
    dependabot = (ROOT / ".github/dependabot.yml").read_text("utf-8")
    for ecosystem in ("uv", "npm", "github-actions", "docker"):
        assert f"package-ecosystem: {ecosystem}" in dependabot
    codeql = (ROOT / ".github/workflows/codeql.yml").read_text("utf-8")
    assert "github/codeql-action/analyze@" in codeql
    release = (ROOT / ".github/workflows/release.yml").read_text("utf-8")
    assert "actions/attest-build-provenance@" in release
    assert "pypa/gh-action-pypi-publish@" in release
    jobs = dict(re.findall(r"^  ([\w-]+):\n((?:    .*\n|\n)*)", release, re.MULTILINE))
    for job in ("attest", "pypi", "npm"):
        assert "id-token: write" in jobs[job], job
    assert "--provenance" in release
    assert "git tag -s" in release  # the verify job rejects unsigned tags


def test_security_policy() -> None:
    """SEC-009: SECURITY.md routes reports to GitHub advisories, promises disclosure within
    90 days and lists the supported versions."""
    policy = (ROOT / "SECURITY.md").read_text("utf-8")
    assert "/security/advisories/new" in policy
    assert "90 days" in policy
    assert "## Supported versions" in policy
    assert re.search(r"^\| Version \| Supported \|$", policy, re.MULTILINE)
