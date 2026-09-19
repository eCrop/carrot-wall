# Spec: pin and hide

**Author:** Pedro Fonseca · **Date:** 2026-09-19 · **Status:** draft
**From intent:** `docs/intents/05-pin-and-hide.md` · **Covers:** spec F4 · **Depends on:** slice 03

## Problem

By Wednesday the wall is long and the post worth discussing is buried in the middle of it.
Less often but more urgently, something goes up that should not be on a projector in front of
a client's engineering team, and the instructor needs it gone in one click. Most of the
plumbing already exists (`Post.pin()/unpin()/hide()/unhide()`, hidden-aware ordering in
`Post.firstPage`/`before`/`changedSince`, `removedIds` in `WallResponse`) — this slice adds the
admin endpoints and controls that call it, proves the existing ordering/visibility rules were
built right, and gives the public wall a dedicated pinned-posts strip instead of pinned cards
sitting inline at the top of the grid.

## In scope

**Admin API**
- `POST /api/admin/posts/{id}/pin`, `/unpin`, `/hide`, `/unhide` — admin-only (slice 03's shared
  401 filter), each a bodyless toggle calling the matching `Post` method. 404 for an unknown
  post id. Each bumps `updated_at` (via the entity's existing `@PreUpdate`) and touches nothing
  else — no reordering side effects on pin/unpin, no content change on hide/unhide.
- `PostDto` gains a `hidden` boolean (mirrors `pinned`) so an admin's `includeHidden` response
  can mark hidden posts instead of just including them unmarked. Always present, always
  `false` for anything reaching a non-admin caller (a hidden post can't reach one at all).

**Web `/admin` wall — per-card pin/hide controls**
- Each card gets a "Fixar"/"Desfixar" button (reflecting current `pinned`) and an
  "Ocultar"/"Reexibir" button (reflecting current `hidden`), calling the new endpoints. Both
  update the card in place, no reload.
- A hidden card renders visibly different from a normal one (dimmed/muted treatment + a small
  "Oculto" label) so the instructor can find it again to unhide it — this is the only place
  hidden content is ever rendered.

**Web `/` — pinned posts carousel**
- Pinned posts move out of the regular card grid into a dedicated strip above it, newest-pinned
  order preserved (matches the existing `Post.firstPage` ordering — no API change needed for
  order). Unpinned posts render as today.
- Shows up to 3 pinned posts at a time; auto-advances every 6s. Dot indicators below the strip
  show position and are tap/click-navigable. Strip is absent entirely when there are zero
  pinned posts (no empty carousel chrome).
- Auto-advance pauses on hover, touch, and keyboard focus within the strip, and resumes when
  it's released — same WCAG 2.2.2 pattern applied to nothing else on the wall so far. When
  `prefers-reduced-motion` is set, the strip renders its first page with no auto-advance; dot
  navigation still works.
- Built as its own component (`pinned-carousel` or similar) rather than inline in `WallComponent`
  so slice 08 can drop the same component into `/tv` without rebuilding it. This slice does not
  create a `/tv` route or wire the component in there — that stays slice 08's job.
- A newly-pinned post (picked up via poll) inserts into the strip; a newly-unpinned one returns
  to the regular grid — both without a page reload, following the existing poll-merge behavior.

**Tests**
- JUnit: pin/unpin/hide/unhide each flip exactly their own field and bump `updated_at`, and
  leave every other field (`upvotes`, `answerText`, the other three of this quartet) untouched;
  a hidden post is absent from a non-admin `GET /api/wall` (first page, `before`, and `since`
  variants) but present (with `hidden: true`) in an admin `includeHidden=true` call; each
  endpoint 401s without a session and 404s for an unknown id; pinned posts sort ahead of newer
  unpinned ones in `GET /api/wall`.
- Angular: admin card's Fixar/Ocultar buttons toggle state and label without a reload; a hidden
  admin card renders its "Oculto" marker; the public wall renders pinned posts in the carousel
  strip and not in the grid; the strip shows at most 3 at once and paginates via dots; auto-
  advance pauses on hover/focus and is disabled under `prefers-reduced-motion`; the strip
  disappears when no posts are pinned.

## Out of scope

- A limit on how many posts can be pinned — unlimited, the carousel is how the UI absorbs that
  instead of a cap.
- Building the `/tv` route or wiring the carousel component into it — slice 08's own scope; this
  slice only makes the component reusable there.
- Any push/websocket mechanism to remove a hidden post from a screen before the next poll — the
  existing 5s poll cycle (`removedIds` on `since=`) is the only removal path.
- Auto-unhiding, hide reasons/audit trail, or a "why was this hidden" note — hide/unhide is a
  bare toggle, same as pin/unpin.
- Swipe gestures on the carousel beyond the dot navigation (touch still pauses auto-advance, but
  drag-to-scroll is not required).

## Acceptance criteria

1. `POST /api/admin/posts/{id}/pin` sets `pinned = true`; `/unpin` sets it `false`. Both bump
   `updated_at`, leave `upvotes`/`hidden`/answer fields untouched, and 404 for an unknown id.
2. `POST /api/admin/posts/{id}/hide` sets `hidden = true`; `/unhide` sets it `false`. Both bump
   `updated_at`, leave every other field untouched, and 404 for an unknown id. The row is never
   deleted.
3. All four endpoints return 401 with no valid admin session cookie and make no change.
4. A hidden post is absent from `GET /api/wall` (no params), `GET /api/wall?before=...`, and a
   non-admin `GET /api/wall?since=...` (it appears in that response's `removedIds` instead) —
   but its id and full content are still retrievable via row count / an admin
   `includeHidden=true` call, where `hidden: true` is now visible on its `PostDto`.
5. Pinned posts sort ahead of all unpinned posts in every `GET /api/wall` mode, newest-pinned
   first among themselves — proving slice 01's ordering rule.
6. On `/admin`, tapping Fixar/Desfixar and Ocultar/Reexibir flips the button label and the
   card's visible state (pin marker, "Oculto" treatment) without a reload.
7. On `/`, pinned posts render only in the top carousel strip, never duplicated in the grid
   below; the strip shows nothing when there are zero pinned posts.
8. The carousel shows at most 3 pinned posts at a time and auto-advances every 6s when more
   than 3 are pinned; dot indicators reflect and control position.
9. Hovering, touching, or focusing the carousel pauses auto-advance; releasing resumes it.
   `prefers-reduced-motion` disables auto-advance entirely (dots still work).
10. A poll (`since=`) that adds a new pinned post inserts it into the strip; one that unpins a
    post moves it back into the regular grid — both in place, no reload.
11. `./mvnw test` and `npm test` pass from a fresh clone, including new tests for this slice.

## Constraints

- Hidden is a soft delete and only a soft delete — no endpoint in this project ever deletes a
  post row.
- Never mutate `Post` via a bulk `update(...)` string — use `pin()`/`unpin()`/`hide()`/
  `unhide()` so `@PreUpdate` fires and `updated_at` moves (CLAUDE.md convention, already how
  `answer()` works).
- Pin/unpin and hide/unhide are independent of each other and of `answer()` — none of the four
  new endpoints touches fields the others own.
- `PostDto`'s new `hidden` field must never read `true` for a response a non-admin client can
  receive — a hidden post reaching a public client at all is the bug this slice exists to
  prevent.
- Carousel auto-advance must be pausable (hover/touch/focus) and must respect
  `prefers-reduced-motion` — not optional polish, it's the accessibility bar for any
  auto-moving content lasting more than ~5s.
- Portuguese UI, warm microcopy, consistent with slices 01–04.
