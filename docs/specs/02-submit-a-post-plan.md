# Slice 02 — submit a post (`/post`)

## Context

Carrot Wall's wall can be read but not written to. Slice 02 delivers spec F2: a `POST /api/posts`
endpoint with server-side validation and a rate limiter, and a mobile-first `/post` form that
lands the author back on the wall with their own post briefly ringed in coral.

Spec: `docs/specs/02-submit-a-post.md`. The interview behind it resolved three open questions —
rate limiting is keyed on a **browser token, not IP** (the whole classroom shares one public IP
behind Railway), type chips **default to `livre`**, and the message is **trimmed before** the
1–280 check.

**Why this plan supersedes `docs/specs/02-submit-a-post-plan.md`:** that file was written when
slice 01's API appeared to be merged into the main worktree. It since moved to its own worktree
and branch, leaving `master` at the bare scaffold. The dependency structure is different enough
that the plan needs rewriting — that rewrite is the first task below.

## Verified current state

| Where | State |
|---|---|
| `master` (`~/Documents/carrot-wall`) | Bare scaffold. Only `SpaRoutes.java` (already reroutes `/post` → `index.html`, no change needed), migrations V1–V3, stock Angular app. |
| `slice-01-wall-view` (`~/Documents/carrot-wall-slice-01`) | **API only.** `Post`, `Prompt`, `PostDto`, `PromptDto`, `WallResponse`, `WallResource`, V4 migration, `WallResourceTest` (6 tests). Plus TS strict mode, spec §4 tokens in `styles.scss`, and an uncommitted `index.html` font change. |
| Slice 01's **web** side | **Not built.** `app.routes.ts` is `[]`, no `provideHttpClient()`, no `WallComponent`/`WallService`/`PostCardComponent`. Its plan's steps 5–9. |
| Playwright | Not installed. `npm test` → `ng test` (vitest + jsdom). |

Reusable from slice 01: `Post` entity (public fields, `pin()/hide()/upvote()/answer()`, static
finders), `PostDto` record + package-private `PostDto.from(Post)`, the `--wall-*` design tokens.
Schema already fits — `message VARCHAR(280) NOT NULL`, `name VARCHAR(40)`, `type VARCHAR(20)`,
**no CHECK constraint on `type`**, so type validation must live in app code.

## Setup

Worktree created, branched off slice 01's tip:

```
git worktree add ../carrot-wall-slice-02 -b slice-02-submit slice-01-wall-view
```

Phases A → B → C are ordered by dependency. Phase A touches zero files slice 01's web work
touches. Phases B and C each begin by rebasing onto slice 01's latest.

---

## Phase A — the create API (independent, start now)

**A0.** Rewrite `docs/specs/02-submit-a-post-plan.md` to match this plan.

**A1. `RateLimiter.java`** — `@ApplicationScoped`, one method `boolean allow(String token)`:
a null/blank token returns `true` unchecked (the header is a friendly-room guard, not auth, and
a missing one must never block a legitimate post); otherwise a `ConcurrentHashMap<String,
Deque<Instant>>` pruned of entries older than 60s, allowing while the pruned count is `< 5`.
Constants, not config — 6 requests in a test is cheaper than a config knob.
*ponytail: in-memory, single-process; resets on redeploy and won't span instances — fine, prod
is one container per `CLAUDE.md`.*

**A2. `CreatePostRequest.java`** — plain record `(String name, String message, String type)`.
No Bean Validation annotations: the spec requires trimming *before* length-checking, which
`@NotBlank`/`@Size` don't do, and a hand-written check beats a custom constraint for one field.

**A3. `Post.create(name, message, type)`** — static factory on the existing entity, next to
`pin()`/`hide()`/`upvote()`. Trims, stores `null` for a blank name, persists. Matches the
entity's established shape (its own doc comment warns against bypassing the lifecycle hooks) and
keeps "how a post is built" out of the resource.

**A4. `PostsResource.java`** — `@Path("/api/posts")`, `POST`, consumes/produces JSON:

1. trim `message` and `name`; `message` must be 1–280 chars after trim, else **400**
2. `type` must be one of `quero-aprender` / `pergunta` / `frustração` / `livre`, else **400**
3. `RateLimiter.allow(<X-Client-Token header>)`, else **429**
4. otherwise `Post.create(...)` → **201** with `PostDto.from(post)`

Error bodies are a small `ApiError(String message)` record carrying Portuguese copy — never a
raw constraint violation. `PostDto.from` is package-private and `PostsResource` shares its
package, so no visibility change is needed.

**A5. `PostsResourceTest.java`** — RestAssured, following `WallResourceTest`'s existing shape.
**Each test must use its own random token**, because the limiter is an `@ApplicationScoped`
singleton shared across tests in one Quarkus instance.

*Phase A verify:* `./mvnw test` green, then `./mvnw quarkus:dev` and
`curl -X POST localhost:8080/api/posts -H 'Content-Type: application/json' -d '{"message":"oi","type":"livre"}'`
returns 201 with an id; the same call with `{"message":"   "}` returns 400 and a PT message.

---

## Phase B — the `/post` form (rebase first)

Rebase onto slice 01's latest so `app.config.ts` and `app.routes.ts` are edited once, against
final content.

**B1. `app.config.ts`** — add `provideHttpClient()` if slice 01 hasn't already.

**B2. `client-token.ts`** — `getClientToken()`: `crypto.randomUUID()` on first call, cached in
`localStorage`. Wrapped in try/catch with an in-memory fallback, because `localStorage` throws in
private mode. A plain function, not a service — nothing here needs DI.

**B3. `post/post.ts` / `.html` / `.scss`** — standalone `PostComponent`:
message textarea with a live counter (max 280), optional name input (placeholder "Anónimo",
max 40), four type chips defaulting to `livre`, submit button. POSTs with the `X-Client-Token`
header. **Plain `<button>` chips with `aria-pressed` and native inputs styled from the `--wall-*`
tokens**, not Angular Material — the spec's look is custom enough that theming Material costs
more than it saves here, and Material stays available for later slices. Inputs at ≥16px so iOS
doesn't zoom. Client-side checks mirror the server as a courtesy only. 400 and 429 map to fixed
PT strings, never the raw body.

The success handler calls `router.navigate(['/'], { queryParams: { highlight: id } })` — the
final behavior, written now. It cannot be exercised for real until Phase C (no `/` route exists),
so **B4 tests it with a Router spy**.

**B4. `post/post.spec.ts`** — counter and 280 cap, `livre` pre-selected and chip switching,
empty submit fires zero HTTP calls (`HttpTestingController`) and shows the PT error, 429 renders
the PT rate-limit copy, success calls `Router.navigate` with the right `highlight` id.

**B5. Playwright** — install `@playwright/test`, add `playwright.config.ts` and
`apps/web/e2e/`, and add a separate `npm run e2e` script (Playwright cannot run under `ng test`).
To avoid a dead placeholder, the first e2e asserts what is real today: `/post` loads, an empty
submit shows the PT error and issues no request. The full submit-and-see-it-appear spec is C4.

*Phase B verify:* `npm test` green; `npm run e2e` green; `/post` at 360px in devtools has no
horizontal scroll and computed input `font-size` ≥16px.

---

## Phase C — wall integration (done)

**Gate cleared:** slice 01 landed `WallComponent`, route `''`, `WallService`, `PostCardComponent`
(commits `1257636`..`dacc23c`) before this phase started. Rebased slice-02-submit onto that tip —
one expected one-line conflict in `app.routes.ts` (both branches added a route to the same array
literal), resolved by keeping both routes.

**C1.** `WallComponent` now injects `ActivatedRoute`/`Router` and reads `?highlight=<id>` in
`ngOnInit`. An `effect()` watches `WallService`'s existing `posts` signal (no service change
needed) and only starts the 2s clock once the highlighted post has actually loaded — avoiding
the page-1-fetch-vs-navigation race the setup plan called out. The query param clears
(`router.navigate([], { queryParams: {}, replaceUrl: true })`) the instant the post is found,
independent of the 2s ring — a refresh mid-ring won't re-trigger it, and the transient
`?highlight=` URL state is too fast to reliably assert on (see C4's fix).

**C2.** `PostCardComponent` got a `highlighted = input(false)` and a `.post-card--highlighted`
class binding, following the exact `[class.post-card--pinned]` pattern already there. The ring
is a `box-shadow` **transition** (200ms, matching `post-card-in`'s existing timing), not a
`@keyframes` animation — the class toggles on/off and the transition handles both directions,
so it didn't need to know which direction was happening. Respects the existing
`prefers-reduced-motion` block.

**C3.** Confirmed: the real navigation from `/post` resolves against the now-real `/` route.

**C4.** The full Playwright e2e was added, and one real bug surfaced twice along the way:
- The submit button was originally disabled for an empty message, making the "empty message
  shows a PT error" behavior (acceptance criterion 3) unreachable via the UI — caught in Phase B.
- The e2e's first version asserted on the transient `/?highlight=<id>` URL, which is a race
  against the same lookup that clears it — the assertion was flaky by construction, not the
  app. Fixed by asserting on the visible ring (held open for a real 2s) instead of the URL,
  which only needs to match a URL pattern that accepts either state. Verified stable across
  3 repeats (`npx playwright test --repeat-each=3`), all passing.

**C5.** Updated `docs/specs/02-submit-a-post.md` criterion 9: Playwright runs under
`npm run e2e`, not inside `npm test`.

---

## Files

| File | Change |
|---|---|
| `apps/api/.../wall/RateLimiter.java` | new — sliding window, keeps `PostsResource` about HTTP |
| `apps/api/.../wall/CreatePostRequest.java`, `ApiError.java` | new — request body, PT error body |
| `apps/api/.../wall/Post.java` | edit — add `create(...)` factory |
| `apps/api/.../wall/PostsResource.java` | new — the write endpoint |
| `apps/api/src/test/java/.../PostsResourceTest.java` | new |
| `apps/web/src/app/app.config.ts`, `app.routes.ts` | edit — `provideHttpClient()`, `/post` route |
| `apps/web/src/app/client-token.ts` | new |
| `apps/web/src/app/post/post.{ts,html,scss,spec.ts}` | new — the form |
| `apps/web/playwright.config.ts`, `apps/web/e2e/*.spec.ts`, `package.json` | new — e2e convention + `npm run e2e` |
| `apps/web/src/app/wall/wall.ts`, `post-card.{ts,scss}` | edit, **Phase C** — highlight param + coral ring |
| `docs/specs/02-submit-a-post-plan.md`, `02-submit-a-post.md` | rewrite / amend |

No new migration: V1–V4 already cover every column this slice writes.

## Verification

**JUnit** (`./mvnw test`) — valid post persists trimmed with the right type; blank name persists
as `null`, not `""` and not `"Anónimo"`; boundaries 0 / whitespace-only / 281 rejected, 1 / 280
accepted; unknown `type` rejected; 5 posts on one token succeed and the 6th returns 429; a second
token's 6th still succeeds; no `X-Client-Token` header never rate-limits.

**Angular** (`npm test`) — as B4.

**Playwright** (`npm run e2e`) — B5's validation spec, then C4's full flow.

**Manual** — 360px layout and ≥16px inputs; a `<script>alert(1)</script>` message stored and
later rendered as literal text on `/`; six rapid submits → the sixth shows PT rate-limit copy,
no stack trace.

## Risks

1. ~~Phase C is gated on another branch.~~ Resolved: slice 01's web side landed and the rebase
   in Phase C had exactly the one expected conflict (`app.routes.ts`), a one-liner.
2. **Rebasing onto a moving branch.** Both slices edited `app.config.ts` and `app.routes.ts`;
   slice 01 also rewrote `app.html` and deleted `app.spec.ts`. In the event, `app.config.ts`
   merged cleanly (slice 01 landed `provideHttpClient()` itself, matching what Phase B had
   already added) and `app.routes.ts` needed the one manual merge described in Phase C.
3. **`frustração` carries a diacritic** through JSON, the URL-free request body, and a
   `VARCHAR(20)` column (10 chars, fits). Quarkus defaults to UTF-8; worth one explicit assertion
   in `PostsResourceTest` rather than trusting it.
4. **The limiter is a shared singleton in tests.** A per-test random token is mandatory, or tests
   pollute each other depending on execution order.
5. **A cleared `localStorage` resets that browser's window.** Accepted by the spec — friendly-room
   guard, not security.
