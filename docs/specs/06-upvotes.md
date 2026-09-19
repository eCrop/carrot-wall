# Spec: Upvotes

**Covers:** spec F5, §7.6 · **Intent:** `docs/intents/06-upvotes.md`

## Problem

Duplicate posts pile up because there's no way to say "that one, please" without adding another
card. The instructor can't tell which questions the room actually wants answered, and the fifteen
people who'd silently agree leave no signal at all.

## In scope

- A ▲ button on every visible post card (wall and admin), tappable once per browser per post.
- `POST /api/posts/{id}/upvote` — increments `Post.upvotes` via the existing `upvote()` mutation
  method (never a bulk `update(...)`), returns the updated post.
- Client remembers which post ids it has upvoted in `localStorage` (a `Set<number>` of post ids,
  mirroring the pattern in `client-token.ts` — falls back to an in-memory `Set` if `localStorage`
  throws). Already-voted posts render the button disabled/checked; a second click never fires the
  request.
- The button updates its own state and the count optimistically, before the poll cycle confirms it.
- 404 if the post doesn't exist or is hidden (hidden posts are excluded from every public
  response, per existing convention — there's nothing to upvote if you can't see it).
- JUnit test: incrementing upvotes via the endpoint, and that a hidden post's id 404s.
- Angular test: clicking the button increments the displayed count and disables further clicks.

## Out of scope (this slice)

- Server-side dedup. The guard is client-side only (`localStorage`), matching the intent's
  "friendly room, not an election" framing — a determined person with a private window can vote
  twice, and that's an accepted cost. No new table/column, no reuse of `X-Client-Token` for this.
- Downvotes, vote history, vote counts on `/tv` — `/tv` doesn't exist yet in this codebase; when
  it's built, F7 already says no admin controls/hover states, so it would show the count as plain
  text with no tap target, never the button. Not this slice's problem to solve.
- Confetti / any visible treatment at 5+ upvotes (spec §8 stretch list, explicitly post-v1).
- Reordering the wall by upvote count — position is createdAt/pinned only, unaffected by votes.

## Acceptance criteria

1. Tapping ▲ on a post increments its displayed count immediately, without waiting for the next
   poll.
2. Tapping ▲ again on the same post (same browser, same post id) does nothing — no second request,
   count unchanged, button shows a disabled/voted state.
3. After a page reload, a previously-upvoted post's button still shows disabled/voted (the
   localStorage guard survives reload).
4. The count upvoting produces is visible to *other* clients within one poll cycle (≤5s) — i.e.
   the increment goes through `Post.upvote()` + normal persistence, so `updated_at` moves and the
   post shows up in `changedSince`.
5. `POST /api/posts/{id}/upvote` for a hidden or nonexistent post id returns 404.
6. Upvoting never changes a post's position in the wall (no reorder on vote).
7. `./mvnw test` covers: a successful increment, and a 404 on a hidden post.
8. `npm test` covers: clicking the button updates the count and disables itself.

## Constraints

- Reuse `Post.upvote()` (already exists) — do not add a bulk `update(...)` string mutation.
- No new migration: `upvotes` column already exists (V2). No new table for vote tracking, per the
  client-side-only decision above.
- Follow existing conventions: JUnit beside the resource (`PostsResourceTest`-style or a sibling),
  Angular test beside `post-card.ts`.
- Button must be reachable via keyboard/tap on a 360px-wide screen (spec F2/§4 mobile-first
  baseline applies to the wall too).
- No `[innerHTML]`; count renders via interpolation as it already does.
