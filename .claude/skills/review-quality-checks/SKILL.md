---
name: review-quality-checks
description: >
  Cross-cutting review checks for SAP BTP apps — security (hardcoded secrets, OData injection, SSRF,
  principal propagation) and code quality (WHY-not-WHAT comment rules, CHANGELOG/semver requirements).
  Load when reviewing any app layer: security checks are always applicable; code quality checks apply
  to any source file. Keywords: secrets, credentials, SSRF, injection, principal propagation,
  comments, TODO, FIXME, CHANGELOG, semver, code quality, dead code.
---

# Review Quality Checks

> Load `references/security-checks.md` for security findings (Cat 6) and
> `references/code-quality-rules.md` for comment and changelog findings (Cat 11).
>
> These checks are **always applicable** — they run regardless of topology flags.
> CORS checks for xs-app.json are in `deployment-checklist → xs-app-security.md` (not here).

## The 2 check areas

### Security checks
Five inline security risks that don't require a specific layer to be present.
See [`references/security-checks.md`](references/security-checks.md) for the full catalogue,
severity rationale, and grep detection commands.

### Code quality checks
Comment hygiene (WHY-not-WHAT rule, dead code, TODO/FIXME) and changelog requirements
(CHANGELOG.md presence, semver versioning, revision history in deliverable documents).
See [`references/code-quality-rules.md`](references/code-quality-rules.md) for the full rules.

---

## Quick reference

| Check | Severity | Guard |
|---|---|---|
| Hardcoded secrets / credentials in source | CRITICAL | Always |
| Credentials in `.env` / `default-env.json` | CRITICAL | Always |
| OData injection (unsanitised query → CQL) | CRITICAL | CAP_PRESENT |
| SSRF (unvalidated URL from req.data) | CRITICAL | CAP_PRESENT |
| Principal propagation on S/4 destinations | CRITICAL | DEPLOYMENT_PRESENT |
| Commented-out code blocks | WARNING | Always |
| `TODO` / `FIXME` / `HACK` in source | WARNING | Always |
| Multi-line "what" docstrings | WARNING | Always |
| `CHANGELOG.md` absent | WARNING | Always |
| `package.json` `version` not semver | WARNING | Always |
| Revision history missing in deliverables | INFO | DELIVERABLES_PRESENT |
