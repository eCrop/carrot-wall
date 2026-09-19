# Spec: wall view (`/`)

**Author:** Pedro Fonseca · **Date:** 2026-09-19 · **Status:** implemented
**From intent:** `docs/intents/01-wall-view.md` · **Covers:** spec F1

## Problem

The room has no way to see what it is thinking. The database has seeded posts and an active
prompt; nothing renders them. This is the first screen anyone sees when they scan the QR on
Monday morning, so it is the first slice worth building — and it is where the Material theme,
the design tokens and the test conventions get established for every slice after it.

## In scope

**Read API**
- `GET /api/wall` — page 1: the active prompt, **all** visible pinned posts, and the newest
  N (=30) visible unpinned posts. Returns a `serverTime` the client echoes back as `since`.
- `GET /api/wall?before=<createdAt>` — "load more": the next N older **unpinned** visible
  posts. The cursor walks unpinned posts only; pinned posts belong to page 1 and never repeat.
- `GET /api/wall?since=<serverTime>` — the 5-second poll delta: posts created **or modified**
  since that moment, plus `removedIds` (bare ids, no content) for posts that became hidden,
  plus the prompt if it changed. Returns a fresh `serverTime`.
- Hidden posts are excluded in SQL, never filtered in the browser. `removedIds` carries ids
  only, so hiding leaks nothing.

**Migration V4** — `posts.updated_at TIMESTAMP NOT NULL`, backfilled from `created_at`, set by
the application on every write (create, answer, pin, hide, upvote). Without it `since=` can
see a new answer but would miss a pin or an upvote. New versioned file; V1–V3 stay untouched.

**Web `/` route**
- Prompt banner (serif) above a card grid.
- Card: type chip, message, name or "Anónimo", relative time, upvote count, and the
  instructor's answer in a distinct block when present. Read-only — no submit, no upvote
  button yet.
- Order: pinned first (with 📌), then newest first.
- Layout: responsive CSS grid — 1 column at 360px, 2 at tablet, 3 on laptop. Not
  `column-count`: it balances by total height, so prepending a post on each poll would reflow
  cards across column boundaries and they would jump sideways every 5s.
- Poll every 5s, merging the delta into the loaded list. New cards fade in (150–250ms).
  Answers, upvote counts and pin state update in place on already-loaded cards, at any depth.
- "Load more" button at the bottom. Loaded pages stay loaded; the delta keeps them current.
- Empty state: a warm PT line inviting people to write, pointing at the QR.
- Angular Material theme + design tokens from spec §4, set up here for later slices to inherit.

**Tests** — JUnit: pinned-before-unpinned ordering, hidden posts absent from every response
shape, `since=` returns a pinned/upvoted post, `removedIds` on hide. Angular: card renders
each field, `<script>` renders as literal text, empty state, pinned ordering.

## Out of scope

- Submitting posts (slice 02), upvoting (06), admin/answers/pinning (03–05, 07), `/tv` (08).
- Viewport-scoped fetching. The poll refreshes everything **loaded**, not everything on
  **screen** — no IntersectionObserver, no scroll tracking.
- Refreshing pages the user has not loaded. A post 200 deep that nobody scrolled to is not
  fetched.
- Websockets, SSE, virtual scrolling, `DESIGN.md` generation.

## Acceptance criteria

1. `GET /api/wall` on a fresh clone returns the seeded prompt and the seeded posts; `/` shows
   them on first load with no setup beyond `./mvnw quarkus:dev` + `npm start` (spec §7.14).
2. The seeded pinned post renders above every unpinned post, with a 📌 marker (§7.3).
3. A post with `hidden = true` appears in no response from any `/api/wall` variant — verified
   against the JSON, not the DOM (§7.4).
4. A message containing `<script>alert(1)</script>` renders as that literal text (§7.12).
5. With 200 seeded posts: page 1 returns pinned + 30 unpinned; "load more" appends the next 30
   older unpinned with no duplicates and no gaps; the wall stays responsive (§7.13).
6. Insert a post directly into the DB — it fades into the top of the wall within 5s without a
   reload. (Partial §7.2; the full criterion needs slice 02's submit form.)
7. Set `answer_text`, then `pinned`, then `upvotes` directly in the DB on a post sitting on
   page 3 of a scrolled client — each change reaches that card within 5s.
8. Set `hidden = true` on a rendered post — the card disappears within 5s.
9. Change the active prompt row — the banner swaps text on the next poll, with a fade, no
   announcement animation.
10. Usable and readable at 360px width, single column.
11. `./mvnw test` and `npm test` each run and pass from a fresh clone with non-zero tests (§7.15).

## Constraints

- Polling only, every 5s. ~15 clients; no websockets, no SSE.
- Angular interpolation only. No `[innerHTML]` anywhere.
- Flyway owns the schema. V4 is a new file — never edit V1–V3 (a hook enforces this).
- SQL portable across H2-PG mode and real Postgres: no `JSONB`, no arrays.
- Design per spec §4: ivory `#FAF9F5`, tint `#F0EEE6`, ink `#141413`, hairline `#E2DFD6`,
  coral `#D97757`. Hairline borders, 12px radius, **no drop shadows**. Serif for the prompt,
  Inter for everything else. Motion 150–250ms, nothing bouncy.
- Portuguese UI, warm microcopy.

## Note on the intent

`01-wall-view.md` states "The schema is already in place — no migration." The `since=` delta
the poll now depends on makes that false: there is no general `updated_at` column, only
`answer_updated_at`, so pins and upvotes would be invisible to the poll. That line in the
intent needs updating to point at V4.
