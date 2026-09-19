# Plan: Upvotes

**Spec:** `docs/specs/06-upvotes.md`

## Files

**API**
- `apps/api/src/main/java/pt/ecrop/wall/PostsResource.java` — add
  `POST /api/posts/{id}/upvote`: load the post by id, 404 if missing or hidden, call the existing
  `Post.upvote()` mutation method, return the updated `PostDto`. No new entity/DTO fields — both
  already carry `upvotes`.
- `apps/api/src/test/java/pt/ecrop/wall/PostsResourceTest.java` — add tests for the new endpoint
  next to the existing create/rate-limit tests (same file, same style).

Nothing else on the API side: `upvotes` column exists since V2, `Post.upvote()` already exists
and already goes through `@PreUpdate` (`touch()`), so `updated_at` moves and the increment shows
up in `changedSince` for free. No migration, no new table (client-side-only guard, per the spec).

**Web**
- `apps/web/src/app/wall/upvoted-posts.ts` (new) — a `localStorage`-backed `Set<number>` of post
  ids this browser has upvoted, mirroring `client-token.ts`'s try/catch-with-in-memory-fallback
  shape. Two functions: `hasUpvoted(id)`, `markUpvoted(id)`.
- `apps/web/src/app/wall/post-card.ts` — inject `HttpClient` directly (no new service class; the
  only call is a single `POST` with no error-message parsing to justify a wrapper like
  `AdminPostsService`). Add:
  - `voted` signal seeded from `hasUpvoted(post().id)` in an effect keyed on `post().id` (so it
    re-checks if the card is recycled for a different post).
  - `optimisticUpvotes` signal, so the click updates the number instantly; the template shows
    `optimisticUpvotes() ?? post().upvotes`, and the override clears once the poll delivers a
    server count ≥ what we optimistically set (an `effect` watching `post().upvotes`).
  - `upvote()` method: no-ops if already `voted()`, otherwise sets `voted` + bumps
    `optimisticUpvotes` immediately, fires the POST, marks `localStorage` on success; on failure,
    rolls both back and leaves the button clickable again.
- `apps/web/src/app/wall/post-card.html` — turn the static
  `<span class="post-card__upvotes">▲ {{ post().upvotes }}</span>` into a `<button type="button">`
  bound to `upvote()`, `[disabled]="voted()"`, with an aria-pressed/aria-label for accessibility.
- `apps/web/src/app/wall/post-card.scss` — disabled/voted visual state (no shadow per design
  tokens — a filled coral state is enough, matching the "coral only for primary" rule loosely
  since this is the wall's one interactive affordance).
- `apps/web/src/app/wall/post-card.spec.ts` — extend with: click increments the shown count and
  disables the button; a second click doesn't fire a second HTTP request; re-rendering the same
  post id after a fresh `TestBed` (simulating reload) still shows it disabled because
  `localStorage` persisted the vote.

No `upvoted-posts.spec.ts`: `client-token.ts` sets the precedent that this shape of tiny
localStorage helper isn't tested standalone — it's exercised through `post-card.spec.ts` instead.

Not touched: `wall.service.ts` (poll/fetch logic is unrelated to firing a mutation),
`wall.models.ts` (no shape change), `/tv` (doesn't exist yet — out of scope per the spec).

## Order of work

1. API endpoint + JUnit tests. Backend is self-contained and independently verifiable with
   `./mvnw test` before touching the frontend.
2. `upvoted-posts.ts` helper — small and has no dependents yet, easy to eyeball correct.
3. `post-card.ts` + `.html` + `.scss` wiring.
4. Angular tests in `post-card.spec.ts`.
5. Manual check (below).

## Risks / open questions

- **Optimistic-count rollback edge case:** if the POST fails (network blip) after the button is
  already disabled and the count bumped, the plan rolls both back — but if the *next* poll lands
  in between the failed request and the rollback, a stale `optimisticUpvotes` could briefly
  clobber a newer server count. Mitigated by only ever taking `max(optimistic, server)` when
  reconciling, not overwriting — worth a specific test if it turns out to be fiddly in practice.
- **`voted` signal keyed on post id:** `PostCardComponent` isn't currently in a `@for` with
  `track`, so confirm the wall list doesn't recycle card instances across different posts (it
  shouldn't, given `wall.service.ts` keys posts by id in a `Map`) — if it did, the `effect` reset
  is there specifically to handle that, but worth double-checking during manual testing rather
  than assuming.
- Button hit target at 360px: the footer already holds author/time/count in a row; adding a real
  `<button>` there needs a quick look on a narrow viewport to make sure it doesn't wrap awkwardly
  or shrink below a comfortable tap size.

## Verification

- `./mvnw test` (from `apps/api`): new `PostsResourceTest` cases — increment succeeds and returns
  the bumped count, 404 on a hidden post's id, 404 on a nonexistent id.
- `npm test` (from `apps/web`): new `post-card.spec.ts` cases — click bumps the count and disables
  the button; a second click fires no second request; the disabled state survives a fresh render
  once `localStorage` has the id (simulating reload).
- Manual: run both dev servers, open `/` in two browser windows (or one plus a private window),
  click ▲ on a card in one, confirm it goes disabled immediately there, and the count updates in
  the other window within 5s. Reload the first window and confirm the button is still disabled.
  Check the row at 360px width in devtools device mode.
