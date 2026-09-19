# Spec: TV mode (`/tv`)

**Author:** Pedro Fonseca · **Date:** 2026-09-19 · **Status:** implemented, pending slice 07's merge
**From intent:** `docs/intents/08-tv-mode.md` · **Covers:** spec F7 · **Depends on:** slice 05
(pinned carousel), slice 07 (prompt of the moment)

## Problem

For most of the week the wall is displayed on a projector, read from six metres away during
breaks. The existing `/` view is designed for a phone in hand: cards too small to read at
distance, interactive controls that are noise on a screen nobody touches, and nothing telling
a new arrival how to post. `/tv` is a read-only, large-type, self-updating view built for that
screen, reusing the same `/api/wall` endpoint slice 01 already ships — no new API, no schema
change.

**This slice stacks on slice 07** (`docs/specs/07-prompt-of-the-moment.md`), which itself sits
on 05/06. `/tv` cannot be truly finished until 07 is built and its PR is open: 07's own spec and
intent place three obligations on `/tv` (six-metre banner legibility, a prompt change reaching
`/tv` within a poll cycle, XSS-safe prompt rendering) that 07's plan explicitly does not build —
this slice absorbs them, see "Inherited from slice 07" below.

## In scope

- New route `/tv`, read-only, added to `SpaRoutes.java`'s reroute list alongside `/post` and
  `/admin` so a refresh doesn't 404.
- **Prompt banner**: the active prompt as a large serif heading, same data slice 01's banner
  uses, refreshed on the same poll.
- **Layout**: one fixed **pinned slot** above a **row of 3 unpinned cards**. Message text
  renders ≥32px in both.
- **Pinned slot**: if more than one post is pinned, the slot cycles through the pinned set on
  the same 8s beat as the unpinned row (see below). If exactly one pinned post exists it stays
  static; if none, the slot is hidden or replaced with quiet PT copy.
- **Unpinned cycling**: paginate, not scroll. The unpinned pool (most recent visible unpinned
  posts, same data the wall poll already delivers) is split into pages of 3; the page advances
  every 8s. A card shows: type chip, message, name or "Anónimo", relative time, upvote count,
  and the instructor's answer block when present — same fields as the wall card, just larger.
- **Cycling is built on `PinnedCarouselComponent`** (`apps/web/src/app/wall/pinned-carousel.ts`,
  slice 05), reused with configurable page size / interval / interactivity rather than
  reimplemented — that component was built specifically so `/tv` could drop it in unchanged.
- **New posts mid-cycle**: the 5s poll (reused from slice 01's polling pattern) merges new/
  changed posts and removed ids into the in-memory pool the same way the wall does. A post
  that arrives is added to the pool before the next page turn, so it gets its turn within one
  full cycle — it is never silently skipped.
- **QR code**: persistent, bottom-right, ≥180px, generated client-side via a small dependency-
  free JS QR-encoding library (SVG or canvas output, no network call), pointing at the
  absolute URL for `/post`. Present on every frame regardless of cycle state.
- **No interactivity**: no admin controls, no hover states, no clickable elements, no focus
  states — the projector has no pointer.
- **Tests**: Angular unit tests for the pagination/cycling logic (page turn, pinned rotation,
  mid-cycle insertion, removal via `removedIds`) and for `<script>` rendering as literal text;
  one Playwright e2e test per spec §7.15/intent constraint: submit a post via `/post`, confirm
  it appears on `/tv` within one poll+cycle window.

## Inherited from slice 07

Slice 07's plan (`docs/specs/07-prompt-of-the-moment-plan.md`) builds no TV-facing work at all,
but 07's spec and intent place three duties on `/tv` that only this slice can implement (since
`/tv` doesn't exist yet when 07 is built):

1. **Six-metre banner legibility** — 07's intent: "the banner is the largest text on the wall
   and the first thing on the projector." Satisfied by the large serif prompt heading below.
2. **A prompt activated from `/admin` reaches `/tv` within one poll cycle** — 07 spec AC4. Free
   at runtime (`/tv` reads the same `WallService.prompt`), but tested explicitly here.
3. **A prompt containing `<script>alert(1)</script>` renders as literal text on `/tv`** — 07
   spec AC7.

No new API contract is owed: 07 adds no endpoint `/tv` needs beyond the existing
`WallResponse.prompt: {id, text}`.

## Out of scope

- Any change to `/api/wall` or the schema — `/tv` is a pure consumer of slice 01's endpoint.
- Continuous/marquee scrolling.
- Dark variant (spec calls it optional; skipped to keep this slice small — can follow as a
  cheap token-swap addition later).
- Building slice 07's admin prompt selector/activation endpoint itself — only the three
  `/tv`-facing duties above are absorbed here; 07's own implementation stays 07's job.
- Filtering by post type, sound, animations beyond the existing fade/slide conventions.

## Acceptance criteria

1. `/tv` renders the seeded prompt and seeded posts on first load with no setup beyond the
   two existing run commands (spec §7.14).
2. Message text on `/tv` computes to ≥32px in the rendered DOM, for both the pinned slot and
   the 3-card row (spec §7.11, intent constraint).
3. The QR code is present on every frame (including mid page-turn), ≥180px, and decodes to an
   absolute `/post` URL (spec §7.11, intent constraint).
4. With 2+ pinned posts, the pinned slot rotates between them on the same 8s beat as the
   unpinned row; with exactly 1 pinned post the slot is static; with 0, no pinned slot is shown.
5. With more than 3 visible unpinned posts, the unpinned row pages through them 3 at a time
   every 8s, covering the full pool before repeating.
6. Inserting a new visible post directly in the DB causes it to appear on `/tv` within one 5s
   poll + at most one 8s page turn — it is never dropped from the rotation (intent constraint:
   "cycling must not hide new posts").
7. Setting `hidden = true` on a post currently shown on `/tv` removes it before its next
   scheduled appearance, and it never reappears (spec §7.4, via `removedIds`).
8. A message containing `<script>alert(1)</script>` renders as literal text on `/tv` (spec
   §7.12).
9. No element on `/tv` is a button, link, or has a hover/focus affordance — a click or tap does
   nothing observable.
10. Changing the active prompt (direct DB row change, or via slice 07's admin selector once it
    exists) updates the `/tv` banner within one poll cycle (spec §7.7, intent, 07 AC4).
11. Playwright e2e: submitting a post via `/post` on one browser context makes it visible on
    `/tv` in another, within one poll+cycle window (spec §7.15).
12. `./mvnw test` and `npm test` still pass with the new tests included, non-zero (spec §7.15).

## Constraints

- No new REST endpoint, no new migration — reuses `GET /api/wall` (initial + `since=` poll)
  exactly as slice 01 defined it.
- Polling only, every 5s, matching the rest of the app; page-turn timer (8s) is a separate,
  client-only interval independent of the poll.
- Angular interpolation only, no `[innerHTML]` — same XSS constraint as every other view. The
  QR module grid is rendered as `@for`'d SVG `<rect>`s, not via the QR library's own
  HTML-string helpers, to keep this rule intact.
- Design is **TV-scoped**, sourced from `DESIGN.md` (repo root; see Design section below) rather
  than the global `--wall-*` tokens in `apps/web/src/styles.scss` — `/`, `/post` and `/admin`
  are not restyled by this slice. No drop shadows. Motion nothing bouncy, no jarring page-turn
  transition.
- QR library must be a small client-side dependency with no runtime network call (offline-safe
  for a room that may have flaky wifi) — add it to `apps/web/package.json` if none of the
  existing dependencies already cover it. `qrcode-generator` (MIT, zero runtime deps) is the
  chosen library.
- Portuguese UI, warm microcopy, consistent with the rest of the app.

## Design (TV-scoped, from `DESIGN.md`)

`DESIGN.md` (copied to the repo root from a Claude/Anthropic-inspired design export) sets the
direction for `/tv` specifically. Its tokens differ slightly from the app-wide `--wall-*` set
already in `styles.scss` (coral `#cc785c` vs `#d97757`, surface `#efe9de` vs `#f0eee6`,
hairline `#e6dfd8` vs `#e2dfd6`, serif Copernicus/Cormorant Garamond vs Source Serif 4) — those
global tokens are **not** changed by this slice; `tv.scss` declares its own values scoped to the
component.

| Element | Direction |
|---|---|
| Page floor | canvas `#faf9f5` (same as today's `--wall-bg`) |
| Prompt heading | serif, 64px, weight 400 (never bold), −1.5px letter-spacing, 1.05 line-height |
| Post message | ≥32px (this spec's floor), serif-or-sans at a large scale, 1.2–1.3 line-height |
| Cards | surface `#efe9de`, 12px radius, generous (32px) padding, no shadow |
| Pinned card | same card treatment plus a coral hairline — coral stays scarce elsewhere |
| Type chip / meta | pill badge on surface tone, muted `#6c6a64` for secondary text |
| QR corner | a small dark tile (`#181715`) with the QR modules in cream — the one deliberate dark surface on this otherwise cream screen |
| Serif family | Cormorant Garamond 500 at −0.02em, falling back to the app's existing Source Serif 4 |
