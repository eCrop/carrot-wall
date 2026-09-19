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

## Phase C — wall integration (gated)

**Gate:** slice 01 steps 5–8 committed on its branch — `WallComponent`, route `''`, `WallService`,
`PostCardComponent`. Re-check before starting; slice 01's plan delivers all four but says nothing
about `highlight`, so that hook is slice 02's to add. Rebase again first.

**C1.** `WallComponent` reads the `highlight` query param, marks that post id as highlighted for
~2s, then clears the param (`Router.navigate` with `replaceUrl`) so a refresh doesn't re-trigger it.

**C2.** `PostCardComponent` gets a coral ring class driven by that flag — a CSS transition in the
spec's 150–250ms band, no animation library (slice 01 already ruled out `@angular/animations`).

**C3.** Confirm the real navigation from `/post` now resolves.

**C4.** The full Playwright e2e: fill, submit, land on `/`, see the post text, see the ring, see
it gone after ~2s.

**C5.** Update `docs/specs/02-submit-a-post.md` — its criterion 9 says `npm test` includes the
Playwright spec; Playwright runs under `npm run e2e` instead.

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

1. **Phase C is gated on another branch.** Acceptance criteria 1–2 and the full e2e cannot pass
   until slice 01's web side lands. Tracked as a phase, not silently skipped.
2. **Two rebases onto a moving branch.** Both slices edit `app.config.ts` and `app.routes.ts`;
   slice 01 also rewrites `app.html` and deletes `app.spec.ts`. Conflicts should be one-liners —
   rebasing at each phase boundary is what keeps them that way.
3. **`frustração` carries a diacritic** through JSON, the URL-free request body, and a
   `VARCHAR(20)` column (10 chars, fits). Quarkus defaults to UTF-8; worth one explicit assertion
   in `PostsResourceTest` rather than trusting it.
4. **The limiter is a shared singleton in tests.** A per-test random token is mandatory, or tests
   pollute each other depending on execution order.
5. **A cleared `localStorage` resets that browser's window.** Accepted by the spec — friendly-room
   guard, not security.
