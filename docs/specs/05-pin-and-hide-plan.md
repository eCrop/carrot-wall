# Plan: pin and hide

**Spec:** `docs/specs/05-pin-and-hide.md` · **Intent:** `docs/intents/05-pin-and-hide.md` · **Status:** awaiting approval

## Where this worktree starts from

New worktree `carrot-wall-slice-05`, branch `slice-05-pin-and-hide`, branched directly from
`master` at `11c240e` — unlike slice 04, `master` already has every prior slice merged in (the
four `Merge pull request`/`Merge slice-*` commits in the log), so there's no predecessor branch
to stack on; base is `master` itself.

## What's already there, discovered while reading the code

This slice is smaller than the spec reads at first glance — most of the hard part shipped
already, as unused plumbing:

- `Post.pin()/unpin()/hide()/unhide()` already exist and already go through `@PreUpdate`
  (`touch()`), so `updated_at` already moves correctly on all four — nothing to fix here, unlike
  `answer()` in slice 04.
- `Post.firstPage`/`before`/`changedSince`/`hiddenSince` already implement every visibility and
  ordering rule the spec asks for (pinned-first, hidden-excluded-unless-admin,
  hidden-reported-via-`removedIds`-unless-admin). **`WallResourceTest` already has a full test
  matrix proving this**: `pinnedPostsComeBeforeUnpinnedOnesOnPageOne`,
  `hiddenPostsAreAbsentFromEveryResponseShape`, `sincePicksUpAPinChangeWithNoOtherEdit`,
  `sinceReportsANewlyHiddenPostByIdOnlyWithNoMessageLeak`, `includeHiddenSurfacesAHiddenPostWith...`,
  `sinceWithIncludeHiddenKeepsANewlyHiddenPostAsAnUpsertNotARemoval`. Spec ACs 4 and 5 are
  **already true and already tested** — this plan does not re-test them, only the four new
  endpoints that will call `pin()`/`unpin()`/`hide()`/`unhide()` over HTTP.
- `WallService.posts` (Angular) already computes pinned-first ordering client-side from an
  id-keyed map — a poll-driven pin/unpin/hide/unhide already re-sorts for free. Splitting pinned
  from unpinned for the carousel is a `filter()` on that existing computed, not new merge logic.
- `PostDto` **deliberately excludes `hidden`** today ("a hidden post either isn't in the list at
  all, or its id is in `removedIds`") — true for the public case, not for admin's
  `includeHidden=true` case, which is exactly what this slice needs to add.
- `PostCardComponent` already has the `admin` input and an established per-control pattern:
  `AnswerEditorComponent`, its own file under `apps/web/src/app/admin/`, rendered via
  `@if (admin()) { <app-answer-editor [post]="post()" /> }`, refreshing through
  `inject(WallService).poll()` after a successful call rather than a local upsert.
  `post-card.spec.ts` already carries `provideHttpClient()`/`provideHttpClientTesting()` in its
  `TestBed` config for this reason — a second admin control slots into the same setup with no
  new DI wiring.
- `post-card.scss` already has a `@media (prefers-reduced-motion: reduce)` block disabling the
  card's own entry animation — direct precedent for the carousel doing the same, though the
  carousel's auto-advance is timer-driven (TS), not a CSS animation, so its own reduced-motion
  check is a one-time `matchMedia('(prefers-reduced-motion: reduce)').matches` read, not CSS.
- `WallComponent`'s highlight-ring timer test (`wall.spec.ts`,
  `vi.useFakeTimers()`/`vi.advanceTimersByTime()`) is the direct precedent for testing the
  carousel's auto-advance deterministically.
- `/tv` has no route, no component, nothing to wire into yet (`app.routes.ts` only has `''`,
  `'post'`, `'admin'`) — confirmed before writing the spec; the carousel component is built
  standalone and imported by `WallComponent` only.

## Decisions this plan locks in

- **Four new bodyless `POST` endpoints on the existing `AdminResource.java`**, not a new resource
  class or a single parameterized endpoint: `/posts/{id}/pin`, `/unpin`, `/hide`, `/unhide`.
  Matches the `/posts/{id}/answer` precedent exactly — same 404 lookup, same `@AdminOnly`
  `@Transactional` shape, 204 on success. A single `POST /posts/{id}/{action}` was considered and
  rejected: it would need its own action-string validation (a 400 case the spec never asks for)
  for what four `@Path` literals already guarantee at compile time.
- **`PostDto.hidden` is always populated from `post.hidden`, no branch on caller identity.** The
  DTO doesn't need to know who's asking — `WallResource`/`Post.firstPage`/`before`/`changedSince`
  already guarantee a hidden post's `Post` object only ever reaches `PostDto.from(...)` when
  `includeHidden` was true and the session was valid. Adding a second hidden-ness check inside
  the DTO would duplicate a guarantee the query layer already owns.
- **`AdminPostsService` gains the four calls behind one private helper**, not four independent
  try/catch blocks: `private post(id, action): Promise<void>` wraps the shared
  `firstValueFrom(this.http.post(...))` + error-to-`GENERIC_ERROR`-message logic that
  `setAnswer` already has; `pin`/`unpin`/`hide`/`unhide` are one-line callers of it.
- **A new `ModerationControlsComponent`** (`apps/web/src/app/admin/moderation-controls.ts/.html/
  .scss/.spec.ts`), not buttons inlined into `PostCardComponent` or bolted onto
  `AnswerEditorComponent`. Same reasoning slice 04 already wrote down for keeping the answer
  editor separate: `post-card.spec.ts` stays free of interaction/HTTP-flow tests, and pin/hide's
  own submitting/error state doesn't tangle with the answer editor's expand/collapse state.
  Rendered in `post-card.html` next to `<app-answer-editor>` inside the existing
  `@if (admin())` block.
- **Hidden styling lives on `PostCardComponent` itself, not inside the moderation control.** A
  `post-card--hidden` class (dimmed treatment) plus an "Oculto" label bind directly on
  `post().hidden && admin()`, in `post-card.html`/`.scss`, next to the existing pin marker — the
  card's own visual state, not a child component's job.
- **The carousel is a new standalone `PinnedCarouselComponent`**
  (`apps/web/src/app/wall/pinned-carousel.ts/.html/.scss/.spec.ts`) taking
  `posts = input.required<Post[]>()`, already pinned-and-ordered by the caller — it does no
  filtering or sorting itself, just paging/timing/pausing an array it's handed. This is what
  makes it droppable into a future `/tv` component with a different `posts` source and no
  changes to the carousel itself.
  - Pages of ≤3, chunked with a local pure `chunk()` helper.
  - `currentPage` signal, advanced by a `setInterval(6000)` started in the constructor via
    `afterNextRender`/`ngOnInit` (matching `WallComponent`'s `ngOnInit`-driven interval, cleared
    via `DestroyRef.onDestroy`), skipped entirely if `matchMedia('(prefers-reduced-motion:
    reduce)').matches` at construction time.
  - `paused` signal set by `(mouseenter)/(focusin)` on the strip's root element and cleared by
    `(mouseleave)/(focusout)`; the interval tick is a no-op while `paused()` is true rather than
    being torn down and recreated (simpler, and avoids losing position in the auto-advance
    cycle).
  - Dot buttons (`@for` over `pages()`, `track $index`) call `currentPage.set(i)` directly —
    manual navigation is not gated by `paused` or reduced-motion.
  - `currentPage` is clamped by an `effect()` whenever `pages().length` shrinks (a post gets
    unpinned mid-cycle) so it never points past the end.
  - Renders nothing (`@if (posts().length > 0)`) when there are no pinned posts — no empty
    carousel chrome, per spec.
- **`WallComponent` gets two new computed signals, `pinnedPosts`/`unpinnedPosts`**, both
  `filter()`s over the existing `wallService.posts()` — no new sort logic, since `posts()` is
  already pinned-first. `wall.html` branches on `admin()`: admin keeps today's single grid over
  the unfiltered `posts()` (a moderator needs to see and act on every pinned post, not watch it
  rotate — matches the spec exactly); the public wall renders
  `<app-pinned-carousel [posts]="pinnedPosts()" />` above the grid, and the grid itself iterates
  `unpinnedPosts()` instead of `posts()`.

## Order of work

**Phase A — admin toggle API.**

1. **`AdminResource.java`** (edit) — add `pin`/`unpin`/`hide`/`unhide` methods: `Post.findById`,
   404 if null, call the matching entity method, return 204. No request body, no
   `@Consumes` needed on these four.
2. **`PostDto.java`** (edit) — add `boolean hidden` to the record and to `PostDto.from(post)`.
3. **`AdminResourceTest.java`** (edit) — per endpoint: happy path flips only its own field and
   bumps `updated_at`; a sibling post's `pinned`/`hidden`/`upvotes`/`answerText` stay untouched;
   401 with no session; 404 for an unknown id. Plus one case asserting an admin
   `includeHidden=true` `GET /api/wall` now shows `hidden: true` for a hidden post (the one new
   read-side fact this slice adds — everything else in `WallResourceTest` already covers the
   visibility/ordering rules).

**Phase B — web admin controls.**

4. **`wall.models.ts`** (edit) — add `hidden: boolean` to the `Post` interface.
5. **`admin-posts.service.ts`** (edit) — private `post(id, action)` helper; `pin`/`unpin`/`hide`/
   `unhide` methods calling it.
6. **`apps/web/src/app/admin/moderation-controls.ts`/`.html`/`.scss`** (new) —
   `ModerationControlsComponent`: `post = input.required<Post>()`, a Fixar/Desfixar button
   (label from `post().pinned`) and an Ocultar/Reexibir button (label from `post().hidden`),
   each disabled while its own `submitting` signal is true, calling `AdminPostsService` then
   `inject(WallService).poll()` — same refresh pattern as `AnswerEditorComponent`.
7. **`moderation-controls.spec.ts`** (new) — button labels reflect state; clicking each calls the
   right service method and then triggers a poll; a second click is a no-op while the first is
   still in flight (disabled state).
8. **`post-card.ts`/`.html`/`.scss`** (edit) — render `<app-moderation-controls [post]="post()" />`
   next to `<app-answer-editor>` inside `@if (admin())`; bind `post-card--hidden` +
   an "Oculto" label off `post().hidden && admin()`.
9. **`post-card.spec.ts`** (edit) — admin card renders the moderation controls; a hidden admin
   card shows the "Oculto" marker and the dimmed class; a non-hidden/non-admin card shows
   neither.

**Phase C — the public carousel.**

10. **`apps/web/src/app/wall/pinned-carousel.ts`/`.html`/`.scss`** (new) —
    `PinnedCarouselComponent` per the decisions above.
11. **`pinned-carousel.spec.ts`** (new) — renders nothing for an empty `posts` input; shows the
    first ≤3 when given more; auto-advances after 6s (`vi.useFakeTimers()`/
    `vi.advanceTimersByTime`, per `wall.spec.ts`'s precedent); pauses on
    `mouseenter`/`focusin` and resumes on `mouseleave`/`focusout` (assert the page does *not*
    change while paused, does once released); dot click jumps directly; stays on a valid page
    after its input shrinks below the current page index; never starts the interval when
    `matchMedia('(prefers-reduced-motion: reduce)')` is mocked to match.
12. **`wall.ts`** (edit) — add `pinnedPosts`/`unpinnedPosts` computed signals.
13. **`wall.html`** (edit) — `@if (!admin()) { <app-pinned-carousel [posts]="pinnedPosts()" /> }`
    above the grid; grid iterates `admin() ? posts() : unpinnedPosts()`.
14. **`wall.spec.ts`** (edit) — public wall (`admin` false) renders the carousel and excludes
    pinned posts from the grid; admin wall (`admin` true) renders every post in one grid, no
    carousel.

## Files

| File | Change | Phase | Why |
|---|---|---|---|
| `apps/api/.../wall/AdminResource.java` | edit | A | four toggle endpoints |
| `apps/api/.../wall/PostDto.java` | edit | A | `hidden` field for admin reads |
| `apps/api/src/test/.../AdminResourceTest.java` | edit | A | endpoint matrix + one includeHidden read case |
| `apps/web/.../wall/wall.models.ts` | edit | B | `hidden` on the `Post` interface |
| `apps/web/.../admin/admin-posts.service.ts` | edit | B | pin/unpin/hide/unhide calls |
| `apps/web/.../admin/moderation-controls.ts`/`.html`/`.scss` | new | B | the Fixar/Ocultar controls |
| `apps/web/.../admin/moderation-controls.spec.ts` | new | B | control interaction tests |
| `apps/web/.../wall/post-card.ts`/`.html`/`.scss` | edit | B | render controls; hidden styling |
| `apps/web/.../wall/post-card.spec.ts` | edit | B | admin/hidden rendering cases |
| `apps/web/.../wall/pinned-carousel.ts`/`.html`/`.scss` | new | C | the carousel component |
| `apps/web/.../wall/pinned-carousel.spec.ts` | new | C | paging/timing/pause/reduced-motion tests |
| `apps/web/.../wall/wall.ts`/`.html` | edit | C | split pinned/unpinned, wire the carousel in |
| `apps/web/.../wall/wall.spec.ts` | edit | C | public-vs-admin layout cases |

No Flyway migration — no schema change (spec constraint, confirmed: `hidden` already exists as a
column, nothing new is persisted).

## Verification

**JUnit** (`./mvnw test`)
- `AdminResourceTest` — new pin/unpin/hide/unhide cases (toggle + untouched-sibling-fields +
  401 + 404) and the one new `includeHidden` DTO case.
- Full `WallResourceTest` run (unchanged) as a regression gate — this slice must not disturb the
  visibility/ordering behavior it already proves.

**Angular** (`npm test`)
- `moderation-controls.spec.ts`, `post-card.spec.ts`, `pinned-carousel.spec.ts`, `wall.spec.ts`
  per the new/edited cases above.

**Manual**
- Log into `/admin`: pin a post, confirm it jumps to the top immediately and the button now
  reads "Desfixar"; hide a post, confirm it dims with an "Oculto" label and stays visible only
  here; unhide it back.
- Open `/` in a second tab: confirm a pin made in `/admin` appears in the carousel strip (not
  the grid) within 5s; confirm a hide there removes the post from `/` within 5s.
- Pin 4+ posts, watch `/`: strip shows 3, auto-advances to the rest after 6s, dots track
  position; hover the strip and confirm it stops advancing; move away and confirm it resumes.
- DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, reload `/` with 4+ pinned
  posts: strip shows the first page and does not auto-advance; dots still navigate manually.
- `curl -X POST localhost:8080/api/admin/posts/<id>/pin` with no cookie → 401.

## Risks and open questions

1. **`PinnedCarouselComponent`'s reduced-motion check is read once at construction**, not
   reactively — a user toggling the OS setting mid-session won't see it take effect until the
   component re-renders (a poll doesn't recreate it, so effectively "until next page load").
   Matches how the rest of the app already treats `prefers-reduced-motion` (`post-card.scss`'s
   media query is static too), so this is consistent, not a regression — flagging in case the
   bar turns out to be "must be live."
2. **Pause-on-focus for a whole strip of cards is a first for this codebase** — nothing today
   pauses on `focusin`/`focusout` at a container level. Worth double-checking in the browser
   that focusing a button *inside* a pinned card (once moderation controls exist — though the
   carousel itself never renders in admin mode, so this only matters if slice 08's `/tv` reuse
   ever needs focusable content) doesn't fight with the pause/resume logic.
3. **`ModerationControlsComponent` and `AnswerEditorComponent` both call `WallService.poll()`
   independently** — if an instructor pins and then immediately answers the same post, two
   polls fire back to back. `WallService.poll()`'s existing in-flight queue (added in slice 04)
   already serializes these safely; no new fix needed here, just noting why it doesn't race.
4. **No test today exercises two browser tabs against a shared H2 file DB concurrently** — the
   manual "second tab" check above is the only coverage for the actual multi-client scenario the
   feature exists for. Acceptable for this slice's size, but worth knowing it's manual-only.
