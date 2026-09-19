# Spec: instructor answers

**Author:** Pedro Fonseca · **Date:** 2026-09-19 · **Status:** draft
**From intent:** `docs/intents/04-instructor-answers.md` · **Covers:** spec F3 · **Depends on:** slice 03

## Problem

People post questions all week. Answering them verbally only reaches whoever is in the room
at that moment, and a question with no visible answer reads as one nobody cared about. The
wall needs to show that someone replied — from the admin view, editable, without reordering
the room's shared feed.

## In scope

**Answer API**
- `PUT /api/admin/posts/{id}/answer` — admin-only (via slice 03's shared 401 filter). Body
  `{ answerText }`. Non-blank trimmed text sets/replaces the answer; blank, whitespace-only,
  or omitted `answerText` clears it (stored as absent, not an empty string). Sets
  `answer_updated_at` to now and bumps `updated_at` (slice 01's poll column) on every call,
  including clears. 404 for an unknown post id.
- `answerText` max 1000 chars after trim; over that → 400 with a PT message. No minimum beyond
  non-blank.
- Writing or clearing an answer never touches `pinned`, `upvotes`, order, or any other field —
  no reordering side effects.
- No schema change — `answer_text` and `answer_updated_at` already exist from migration V2.

**Public read (`GET /api/wall` and its `before=`/`since=` variants, from slice 01)**
- A post with a non-null `answer_text` includes it (plus `answer_updated_at`) in the response
  shape already defined by slice 01. Clearing removes both fields from future responses and
  is picked up by `since=` like any other update (slice 01's V4 `updated_at` already covers
  this — no further migration).

**Web `/admin` wall — per-card answer control**
- Each card shows a "Responder" (or "Editar resposta" if one exists) link/button, collapsed
  by default. Tapping it expands an inline textarea pre-filled with the current answer (empty
  if none), a live character counter (1000 max), Save and Cancel.
- Save calls the PUT endpoint; on success the textarea collapses back to the link, now reading
  "Editar resposta", and the card's own answer block (same rendering as the public wall) shows
  the new text without a full reload.
- Clearing: emptying the textarea and saving clears the answer — the card loses its ✓ and its
  answer block, and the link reverts to "Responder".
- Inline PT validation error if over 1000 chars; nothing submitted.
- No pin/hide controls here — those stay out of scope (slices 05/06/07's own cards).

**Web `/` and `/admin` — public answer rendering (both share the wall component per slice 03)**
- A card with an answer shows a tinted block under the message, labelled "eCrop", with the
  answer text (interpolation only, same escaping rule as post messages) and a timestamp:
  relative (e.g. "há 12 min") under 1 hour old, else `HH:mm` if answered today, else
  `"d MMM, HH:mm"` (e.g. "18 set, 14:32") for earlier days — reusing whatever relative-time
  helper slice 01 already has, extended with the two absolute branches.
- The card picks up a quiet ✓ (near the type chip or timestamp) whenever an answer is present;
  no ✓ when absent.
- Answering does not move the card — pinned-then-newest ordering (slice 01) is untouched by
  this slice.

**Tests**
- JUnit: setting an answer on a post persists trimmed text and `answer_updated_at`; replacing
  an existing answer overwrites it; clearing (blank body) removes `answer_text` and the public
  read stops returning it; the answer appears in `GET /api/wall` for a post that has one, and
  is absent for one that doesn't; over-1000-char body rejected with 400 and not persisted;
  unauthenticated `PUT /api/admin/posts/{id}/answer` returns 401 (via slice 03's shared
  filter); unknown post id returns 404; setting/clearing an answer leaves `pinned` and
  `upvotes` unchanged and does not reorder `GET /api/wall`.
- Angular: card shows ✓ and the tinted answer block when `answer_text` is present, neither
  when absent; `<script>` in an answer renders as literal text; admin card's "Responder" link
  expands the editor pre-filled with the existing answer, Save persists and collapses back to
  "Editar resposta"; clearing the textarea and saving removes the ✓ and answer block; over-1000
  chars blocks Save with an inline PT error.

## Out of scope

- Auto-pinning a post when it's answered — pin/answer stay independent actions (slice 07 owns
  pinning).
- Any answer history, threading, or multiple answers per post — one answer field, overwritten
  in place.
- Visual distinction between "answered by X" — there's one instructor, the label is always
  "eCrop".
- Notifying the poster that their post was answered (no accounts to notify).
- Changes to `/tv`'s rendering (slice 08's own scope) beyond inheriting whatever `GET
  /api/wall` already returns.
- Rate limiting or auditing on the answer endpoint — it's admin-only and already behind the
  session gate.

## Acceptance criteria

1. `PUT /api/admin/posts/{id}/answer` with a valid session and `{ "answerText": "..." }` sets
   the answer; `GET /api/wall` for that post now includes `answerText` and `answerUpdatedAt`.
2. Calling it again with different text replaces the answer; the public read reflects the new
   text, not the old one.
3. Calling it with `{ "answerText": "" }` or `{ "answerText": "   " }` (or an omitted field)
   clears the answer; the public read for that post no longer includes `answerText`, and its
   card loses the ✓ and the answer block.
4. `answerText` over 1000 chars after trim is rejected with 400 and a PT message; no change
   persisted.
5. The same call with no valid admin session cookie returns 401 (spot-checks slice 03's shared
   filter on this new route) and makes no change.
6. An unknown post id returns 404.
7. Setting, replacing, or clearing an answer does not change the post's `pinned` value, its
   `upvotes` count, or its position in `GET /api/wall`'s ordering.
8. A post with `<script>alert(1)</script>` as its answer renders that literal text on `/` and
   `/admin`, never executes it (same rule as post messages, spec §7.12).
9. On `/admin`, tapping "Responder" on an unanswered card reveals an empty textarea; saving
   non-blank text shows the tinted answer block on that same card without a reload, and the
   link now reads "Editar resposta".
10. On `/`, a poll pulling in a newly-set or newly-cleared answer (via `since=`) updates the
    already-loaded card's ✓ and answer block in place, per slice 01's merge behavior — no
    reload, no reorder.
11. `./mvnw test` and `npm test` pass from a fresh clone, including new tests for this slice.

## Constraints

- Answer max 1000 chars after trim; blank/whitespace clears it, never stored as `""`.
- One answer per post, editable in place — no thread, no history.
- Answers render as text, same escaping rule as post messages: Angular interpolation only, no
  `[innerHTML]`.
- Answering/clearing must not reorder the wall or touch `pinned`/`upvotes`.
- Answer timestamp: relative under 1h, `HH:mm` for same-day, `"d MMM, HH:mm"` for older —
  extends slice 01's existing relative-time formatting rather than introducing a new library.
- No new Flyway migration — V2's `answer_text`/`answer_updated_at` columns already cover this;
  slice 01's V4 `updated_at` already makes answer changes visible to `since=`.
- Admin-only via slice 03's shared 401 filter — this endpoint registers on it, does not
  reimplement the check.
- Portuguese UI, warm microcopy, consistent with slices 01–03.
