# Security Policy

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub: on the repository's **Security** tab, choose **Report a vulnerability** (<https://github.com/0xdolan/unichef/security/advisories/new>).

Include what is affected (the Python CLI, `@unichef/core`, the web app, an extension or a package), the version, and the steps or input that trigger the problem.

- You will get a reply within 7 days.
- A fix is released as soon as possible, and no later than 90 days after the report. Report details are published 90 days after the report, or when the fix is released if that comes first. If a fix needs longer, we will agree a new date with you.
- You will be credited in the advisory unless you ask not to be.

## Supported versions

| Version | Supported |
|---|---|
| Latest release (pre-releases until 1.0.0) | Yes |
| Anything older | No: upgrade to the latest release |

After 1.0.0, the latest minor release of the current major version gets security fixes.

## Threat model

UniChef processes text that may come from anyone. It makes no network requests (SEC-001), and it has no accounts, server or telemetry (SEC-002). The threats it defends against:

| Threat | Mitigation |
|---|---|
| **Malicious input: denial of service.** Huge input, deep nesting, decompression bombs or catastrophic regexes. | Input, output and recursion limits; decompression stops at the output cap; regexes run under a timeout, and constructs that backtrack heavily are rejected (SEC-004, SEC-005). The web app does its work in a worker, so the page stays responsive. |
| **Malicious input: display spoofing.** Invisible characters, bidi controls and look-alike characters that make text appear to be something else. | Detecting these is a core feature: `detect-invisible` and `analyse-characters` show each character by code point instead of rendering it. |
| **Malicious recipe links.** A shared link that runs a recipe the user did not expect. | A link cannot leak data, because nothing is sent over the network. Links with more than 20 steps, or with redacted keys or IVs, open with auto-bake off so the user reviews the recipe first. Keys and IVs are left out of shared links unless the user chooses to include them (SEC-007). |
| **Code injection.** | No `eval`, `new Function`, `innerHTML` with user data or remote code, enforced by lint (SEC-003). The web app's content security policy allows only same-origin scripts and `connect-src 'self'`. The extensions have no host permissions and no content scripts. |
| **Compromised dependency.** | Few runtime dependencies, audited crypto libraries, committed lockfiles installed with `--frozen-lockfile` and `--locked`, SHA-pinned GitHub Actions, Dependabot and CodeQL (SEC-008). |
| **Compromised release.** | Releases come only from signed tags. PyPI and npm use trusted publishing with provenance attestations, and every GitHub Release has `SHA256SUMS`. Verify a download with `gh attestation verify <file> -R 0xdolan/unichef`. |

Out of scope: weaknesses in algorithms that UniChef offers on purpose for analysis, such as ECB mode, MD5 or SHA-1. These are labelled with a `W_INSECURE` warning (SEC-006).
