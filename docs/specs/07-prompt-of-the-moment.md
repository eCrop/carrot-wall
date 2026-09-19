# 07 — Prompt of the moment

## Problem

The active prompt banner (read side) already works: `Prompt.active()` and `WallResource` serve
whatever row in `prompts` has the latest `activated_at`, and every polling client already
displays it. But nothing can change that row today short of a migration. The instructor needs
to switch the room's question from `/admin` — pick one of the five course presets or type one
on the spot — and have it show up on `/` and `/tv` within a poll cycle, with no redeploy.

## In scope

- A new Flyway migration seeding the 5 course preset prompts (text from spec §7.7) into a
  `prompt_presets` table (`id`, `text`), separate from `prompts`. Presets are reference data,
  never activated rows themselves.
- `Prompt.activate(text)`-style mutation: if a `prompts` row with that exact `text` already
  exists, bump its `activated_at` to now; otherwise insert a new row. Never edits a row's
  `text`. (Mirrors the existing `pin()`/`hide()`/`answer()` mutation-method convention — no
  bulk `update(...)`.)
- Admin endpoint (`POST /api/admin/prompt` or similar, under the existing `AdminOnly` gate) that
  accepts either a `presetId` or free-typed `text` (1–200 chars, matching the `prompts.text`
  column) and activates it.
- `GET /api/admin/prompts/presets` (or embedded in the admin bootstrap payload) so the admin UI
  can render the 5 one-tap preset buttons without hardcoding them in Angular.
- Admin UI: a prompt selector on `/admin` — 5 preset buttons + a free-text input with its own
  submit, showing the currently active prompt.
- The existing poll cycle is the only propagation mechanism — no extra push. `/` and `/tv` pick
  up the change on their next 5 s poll, same as pin/hide/answer today.

## Out of scope

- Tagging `Post` rows with the prompt that was active when they were written (no `prompt_id`
  column on `posts`).
- A history/browse UI for reactivating a previously-used prompt that isn't one of the 5 presets
  — retyping or reselecting is enough for a five-day course.
- Editing preset text from the UI (presets are seeded, fixed for the week; editing a preset's
  wording is a new migration, same as any other seed data change).
- Anything beyond PT text — no i18n, no per-preset icons/colors.

## Acceptance criteria

1. `GET /api/admin/prompts/presets` (unauthenticated) returns 401; with the admin session
   cookie it returns exactly the 5 seeded presets.
2. Activating a preset that has never been used inserts a new `prompts` row with that text and
   a fresh `activated_at`.
3. Activating a preset (or free text) whose exact text already exists as a `prompts` row
   updates only that row's `activated_at` — its `text` is untouched and no duplicate row is
   created.
4. Immediately after activation, `GET /api/wall` (and whatever `/tv` reads) returns the new
   `PromptDto` — no separate reload or cache-bust needed, same poll response shape as today.
5. Submitting free text over 200 characters, or empty/blank text, is rejected (400) and does
   not change the active prompt.
6. The admin prompt endpoint returns 401 without the admin session cookie; the active prompt is
   unchanged.
7. A prompt value containing `<script>alert(1)</script>` is stored and later rendered as
   literal text on `/`, `/tv`, and `/admin` (same interpolation-only rule as posts).
8. `/admin` shows which of the 5 presets (if any) matches the currently active prompt's text as
   visually "selected"; free text does not falsely highlight a preset.
9. A JUnit test covers: activating a new preset inserts a row; re-activating existing text bumps
   `activated_at` without creating a second row; the admin endpoint 401s unauthenticated.

## Constraints

- Exactly one active prompt: `Prompt.active()` (latest `activated_at`) — unchanged, already
  correct.
- No bulk `update(...)` on `Prompt`; add a proper mutation method and load-then-mutate, per
  `CLAUDE.md`.
- New Flyway migration only (`V6__...sql` or next free version) — never edit V1–V5.
- Keep migration SQL portable across H2-PG mode and real Postgres: no `JSONB`, no arrays.
- Prompt text renders as text everywhere, never `[innerHTML]`.
- `/admin` prompt selector follows existing admin route/session conventions (401 without PIN
  cookie), matching `AdminOnly`/`AdminAuthFilter`.
