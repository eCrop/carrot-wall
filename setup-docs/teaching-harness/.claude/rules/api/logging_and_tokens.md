---
paths:
  - "apps/api/app/**/*.py"
---

> **Workshop copy — read the shape, not the paths.** A rule file scoped by a path
> glob, which is the mechanism worth copying: knowledge attached to the files it
> applies to, loaded only when those files are touched. The last three bullets
> point at `base.py`, `logfire.py` and `observability.md` in the source repo,
> which are not in this folder. The first two are universal, and they are where
> your own rule file starts.

# GDPR: logging, tokens, entity audit

These rules are enforced — violations are compliance bugs.

- **No PII in log messages.** Never log emails, phone numbers, names, addresses, national/tax IDs, financial data, health data, verification codes, or any personal identifier. Log the user ID or an anonymized reference instead.
- **No PII in JWT tokens.** Token payloads carry only `id` (and standard claims). No email, phone, name, or other personal data in token claims.
- **Redact PII in entity-action logs.** `SENSITIVE_FIELD_PATTERNS` in `app/database/repositories/base.py` is the source of truth — add any new PII field name there so `_sanitize_value` redacts it (it already truncates over-long strings and replaces sensitive fields with `***REDACTED***`).
- **Logfire scrubbing.** Span/log attributes pass through Logfire's scrubber configured in `app/core/logfire.py` (`_scrubbing_callback`). Don't disable scrubbing, and don't pass values into spans that the scrubber wouldn't catch (see `.claude/rules/api/observability.md`).
- **Sanitize exception messages.** Tracebacks and `str(exc)` can contain PII if user-provided values were formatted into them (especially Pydantic `ValidationError`). Strip to `{loc, type, msg}` before logging; never `logger.exception(...)` on a validation error over user/LLM input.
