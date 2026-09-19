# Plan: admin passcode gate (`/admin`)

**Spec:** `docs/specs/03-admin-passcode-gate.md` · **Intent:** `docs/intents/03-admin-passcode-gate.md` · **Status:** implemented

## Where this worktree starts from

**Superseded — see below for what actually happened.** This section originally said: branched
from `slice-01-wall-view` at `72d3a9d`, with slice-01's web side (`WallService`/`WallComponent`)
still uncommitted there, blocking the wall-reuse steps (8–9) until it landed. By the time the
worktree was cut, both `slice-01-wall-view` and `slice-02-submit` had committed and been rebased
(new hashes; `slice-02-submit`'s tip, `4617826`, is a descendant of `slice-01-wall-view` and
carries both slices' work whole — `Post`/`WallResource`, `WallComponent`/`WallService`, `/post`,
`provideHttpClient()`, all committed and clean). So this slice branched from `slice-02-submit`
instead, per Pedro's direction ("build on top of 01 and 02"), and nothing in it was blocked —
every step, including the wall-reuse path (8–9) and criteria 6/7, was buildable and verified in
one pass.

**Mid-implementation, `slice-02-submit` moved again** (Phase C: wall integration, the
`?highlight=` ring feature) after this worktree had already been cut from its earlier tip. Since
nothing was committed here yet, the fix was a clean rebase: `git stash`, `git reset --hard
slice-02-submit` (to the new tip), `git stash pop` — no conflicts, since Phase C touched
`wall.ts`/`wall.html`/`post-card.*`, none of which this slice edits. One follow-on fix was needed:
Phase C added an `ActivatedRoute` dependency to `WallComponent`, so `admin.spec.ts`'s test that
renders `<app-wall>` needed `provideRouter([])` added to its `TestBed` providers (matching
`post.spec.ts`'s existing pattern) — recorded here since it wasn't anticipated in the original
plan.

## Decisions this plan locks in

- **The 401 mechanism is a JAX-RS `@NameBinding`, not a path-prefix filter.** A marker
  annotation `@AdminOnly` + a `@Provider ContainerRequestFilter` bound to it. Slices 04–07 make
  their new resource methods admin-only by adding `@AdminOnly` to them — no shared base class,
  no path convention to remember, no chance of a `/api/admin/*` path typo leaving a route
  unguarded. This is what "the rule is set here once" cashes out to in code.
- **`GET /api/admin/session` *is* the admin-only route being proven, not a separate probe.**
  It's annotated `@AdminOnly` itself: no cookie → the filter aborts with 401 before the method
  runs; valid cookie → the filter lets it through and the method just returns 200. This is also
  the acceptance-criterion-5 test target — no placeholder resource needed to prove the shared
  filter works on a route with real business meaning.
- **Sessions are an in-memory token set, not a JWT or a DB row.** `AdminSessionStore`
  (`@ApplicationScoped`, `ConcurrentHashMap.newKeySet<String>()`): `create()` mints a
  `SecureRandom`-backed opaque token and adds it; `isValid(token)` checks membership. No
  expiry, no eviction — matches "no logout, no expiry beyond the browser session ending" from
  the spec. *ponytail: resets on redeploy, and every login before a restart quietly stops
  working — fine for one instructor's laptop over five days; revisit only if that stops being
  true.*
- **`WallResource` checks the cookie itself; it does not sit behind `@AdminOnly`.** The spec
  requires `?includeHidden=true` to be silently ignored (not 401'd) when there's no session,
  because attendees hit this same endpoint unauthenticated every 5s. So `WallResource` gets a
  `@CookieParam` and asks `AdminSessionStore.isValid(...)` directly, downgrading `includeHidden`
  to `false` rather than rejecting the request.
- **`includeHidden=true` changes `since=`'s `removedIds` semantics, not just the filter.** For
  a public (non-admin) poll, a newly-hidden post's id goes into `removedIds` and its content
  never appears. For an admin poll with `includeHidden=true`, that same post must stay visible
  as an ordinary upsert — it's still on the admin wall — so `changedSince` drops the
  `hidden = false` predicate entirely when `includeHidden` is true, and `hiddenSince` (which
  builds `removedIds`) is skipped altogether in that case. Getting this wrong would make a
  post the instructor is looking at vanish from their own screen the moment they hide it.
- **`PostDto` stays exactly as-is — no `hidden` field added.** The spec explicitly puts "visual
  distinction for hidden posts" out of scope; adding the field now with nothing reading it is
  exactly the kind of speculative plumbing to skip. Slice 05 (hide control) adds it when
  something on the page actually needs to know.
- **Web: one Angular `InjectionToken<boolean>` (`WALL_INCLUDE_HIDDEN`, default `false`)
  controls whether `WallService` sends `includeHidden=true`.** `WallService` stays
  `providedIn: 'root'` for the public `/` route (default `false`, unchanged behavior).
  `AdminComponent` re-provides both the token (as `true`) and a fresh `WallService` instance in
  its own `providers` array, so the singleton the public wall uses is never touched. This is
  what lets `<app-wall>` be reused verbatim on `/admin` instead of forking a second copy of the
  card grid, polling loop, and merge logic.
- **The passcode form and the admin wall are two states of one `AdminComponent`, not two
  routes.** `/admin` never round-trips through the router between "gate" and "wall" — it's an
  `@if` on a `loggedIn` signal set by the session check on init and by a successful login. This
  also keeps `SpaRoutes.java`'s existing `/admin` reroute untouched.

## Order of work

**API (steps 1–6), then web (steps 7–11); step 11 is where they meet.**

1. **`AdminOnly.java`** — `@NameBinding` marker annotation (`@Retention(RUNTIME) @Target({TYPE,
   METHOD})`). First, because everything else in the filter design points at it.

2. **`AdminSessionStore.java`** — `@ApplicationScoped`; `String create()`, `boolean
   isValid(String token)`. Deliberately has no `invalidate`/`remove` — nothing in this slice
   calls one.

3. **`AdminAuthFilter.java`** — `@Provider @AdminOnly`, `implements ContainerRequestFilter`.
   Reads the `admin_session` cookie; if missing or `!isValid(...)`, `requestContext.abortWith(
   Response.status(401).build())`. *Verify:* nothing yet — no `@AdminOnly` route exists until
   step 5.

4. **`AdminLoginRequest.java`** — record `(String pin)`, mirrors `CreatePostRequest`'s
   no-annotations style from slice 02 (the one field is checked by hand in the resource, not
   worth a Bean Validation constraint).

5. **`AdminResource.java`** — `@Path("/api/admin")`. `POST /login`: compare the trimmed body
   PIN against `wall.admin-pin`; match → `store.create()`, set-cookie (`admin_session`,
   `HttpOnly`, `SameSite=Lax`, no `Max-Age`), 200; mismatch → 401, no cookie.
   `GET /session`, `@AdminOnly`: body-less 200 (the filter did the work).
   *Verify:* `AdminResourceTest` (below) + `curl -i -X POST localhost:8080/api/admin/login -d
   '{"pin":"0000"}' -H 'Content-Type: application/json'` shows a `Set-Cookie` header; replay
   that cookie against `curl -i --cookie "admin_session=<value>" localhost:8080/api/admin/session`
   → 200; without it → 401.

6. **`WallResource.java` + `Post.java`** — add `@QueryParam("includeHidden") boolean
   includeHidden` and `@CookieParam("admin_session") String adminSession` to `wall(...)`;
   compute `effectiveIncludeHidden = includeHidden && sessionStore.isValid(adminSession)`; pass
   it into `Post.firstPage`, `Post.before`, and a new `Post.changedSince(since,
   includeHidden)` overload that drops the `hidden = false` predicate when true and skips
   `hiddenSince` in that branch. This is the one place slice 01's read path changes.
   *Verify:* extend `WallResourceTest` (below) before moving on — this is existing, tested
   behavior being modified, not new code in a vacuum.

7. **`apps/web/src/app/admin/admin-auth.service.ts`** — `checkSession(): Promise<boolean>`
   (`GET /api/admin/session`, `true` on 200, `false` on any error incl. 401 — `catchError` to
   `of(false)`, not a thrown rejection the caller has to remember to catch);
   `login(pin: string): Promise<boolean>` (`POST /api/admin/login`, same true/false shape).

8. **`apps/web/src/app/wall/wall.service.ts`** — add `export const WALL_INCLUDE_HIDDEN =
   new InjectionToken('WALL_INCLUDE_HIDDEN', { factory: () => false })`; inject it and append
   `includeHidden=true` to every `fetch()` call's params when it's `true`. The public route's
   injector never provides it, so `/` is byte-for-byte unchanged.

9. **`apps/web/src/app/admin/admin.ts/.html/.scss`** — `AdminComponent`: `providers: [{
   provide: WALL_INCLUDE_HIDDEN, useValue: true }, WallService]` (the second entry gives this
   subtree its own `WallService` instance rather than reconfiguring the app-wide singleton).
   `ngOnInit` calls `checkSession()` into a `loggedIn` signal. Template: `@if (loggedIn()) {
   <app-wall /> } @else { <form> one PIN input, submit, inline PT error signal }`. Submit calls
   `login(pin)`; success sets `loggedIn` to `true` (same-component state flip, no navigation);
   failure sets the error signal and clears nothing else.
   *Note:* this step needs `WallComponent` to exist in this worktree. If slice-01's web work
   hasn't landed here yet (see Risks §1), stub this out behind the gate logic and land the
   `<app-wall>` line last, once it's available — the gate and the login form are fully
   testable without it.

10. **`apps/web/src/app/admin/admin.spec.ts`** — gate renders the form when `checkSession`
    resolves `false`; wrong PIN shows the PT error and does not flip `loggedIn`; a resolved
    `true` session renders `<app-wall>` (or its stand-in, per step 9's note) directly, no form.

11. **`apps/web/src/app/app.routes.ts`** — add `{ path: 'admin', component: AdminComponent }`.
    Same additive, expected-to-conflict-trivially edit called out in slice 02's plan; three
    slices now touch this one array.

## Files

| File | Change | Why |
|---|---|---|
| `apps/api/.../wall/AdminOnly.java` | new | the `@NameBinding` future admin routes attach to |
| `apps/api/.../wall/AdminSessionStore.java` | new | in-memory valid-token set |
| `apps/api/.../wall/AdminAuthFilter.java` | new | the one place the 401 rule is enforced |
| `apps/api/.../wall/AdminLoginRequest.java` | new | typed login body |
| `apps/api/.../wall/AdminResource.java` | new | `/login`, `/session` |
| `apps/api/.../wall/WallResource.java` | edit | `includeHidden` param, cookie check |
| `apps/api/.../wall/Post.java` | edit | thread `includeHidden` through the three query methods |
| `apps/api/src/test/java/.../AdminResourceTest.java` | new | login success/failure, session check |
| `apps/api/src/test/java/.../WallResourceTest.java` | edit | `includeHidden` on/off, with/without a valid cookie |
| `apps/web/src/app/admin/admin-auth.service.ts` | new | login + session check calls |
| `apps/web/src/app/wall/wall.service.ts` | edit | `WALL_INCLUDE_HIDDEN` token, param passthrough |
| `apps/web/src/app/wall/wall.service.spec.ts` | edit | asserts the token default and override |
| `apps/web/src/app/admin/admin.ts/.html/.scss` | new | gate + reused wall |
| `apps/web/src/app/admin/admin.spec.ts` | new | gate behavior (needs `provideRouter([])` — `WallComponent` injects `ActivatedRoute` as of slice 02's Phase C) |
| `apps/web/src/app/app.routes.ts` | edit | `/admin` route |

## Verification

**JUnit** (`./mvnw test`)
- `POST /api/admin/login` with the configured PIN returns 200 and a `Set-Cookie` header; wrong
  PIN returns 401 with no `Set-Cookie` header.
- `GET /api/admin/session` returns 401 with no cookie, 401 with a garbage cookie value, 200
  with a cookie obtained from a successful login in the same test.
- `GET /api/wall?includeHidden=true`: with a valid admin cookie, a post seeded/persisted with
  `hidden = true` appears in the response; with no cookie (flag still `true`), it does not, and
  the response shape matches the plain public call exactly.
- `since=` with `includeHidden=true` and a valid cookie: a post hidden after the baseline
  `since` timestamp appears in `posts`, not in `removedIds`. Without the flag/cookie, the same
  scenario puts it in `removedIds` and nowhere else (this is slice 01's existing test, now
  joined by its admin counterpart).

**Angular** (`npm test`)
- `AdminComponent`: unauthenticated load shows the passcode form; wrong PIN shows the PT error
  and the form stays; a successful `checkSession()`/`login()` shows the wall instead.
- `WallService`: a param spy confirms `includeHidden=true` is only ever sent when
  `WALL_INCLUDE_HIDDEN` is provided as `true` — the public route's default path is asserted to
  never send it.

*Two implementation-time findings worth keeping, both caught by these tests rather than in
review:*
- **`AdminAuthService` originally used `response !== null` as its success sentinel** —
  broken, because both `/login` and `/session` return an *empty body on success*, which
  `HttpClient` parses as `null`: identical to what `catchError` produces on failure. The third
  `admin.spec.ts` test (valid session → wall renders) caught this immediately since a genuine
  200 was being read as a failure. Fixed by mapping explicitly (`map(() => true), catchError(()
  => of(false))`) instead of inspecting the body.
- **This app is zoneless** (no `zone.js`, no polyfill entry for it). `fixture.whenStable()`
  only waits on Angular's own tracked pending tasks (the HTTP request itself), not on a
  `.then()` chained on top of it in application code. `admin.spec.ts` needed one extra
  macrotask tick (`await fixture.whenStable(); await new Promise(r => setTimeout(r, 0));`)
  after each flush before asserting — worth remembering for any future async-chained test in
  this codebase, since `wall.spec.ts`'s existing pattern happened not to need it.

**Manual**
- Fresh clone, `curl` the login/session sequence from step 5 by hand.
- Browser: visit `/admin` cold → passcode screen. Enter `0000` (dev default) → wall appears.
  Refresh the tab → wall appears immediately, no re-prompt (session cookie survived).
- Hide a post directly in H2 (`UPDATE posts SET hidden = true WHERE id = ...`) while `/admin`
  is open on that post: it stays on screen within the next 5s poll. Load `/` in a private
  window at the same time: that post is not there.
- 360px devtools width on `/admin`'s passcode screen: no horizontal scroll, input font ≥16px.

## Risks and open questions

1. ~~Blocked on `slice-01-wall-view`'s web side landing in this worktree.~~ **Resolved before
   implementation started:** by the time the worktree was cut, `slice-02-submit` (a descendant
   of `slice-01-wall-view`) had both slices' work committed and clean, so this branched from
   `slice-02-submit` instead and nothing was blocked — see "Where this worktree starts from."
   One real instance of the underlying risk did materialize mid-build: `slice-02-submit`
   advanced again (Phase C: wall integration) after this worktree was cut, requiring a rebase
   (`stash` → `reset --hard` to the new tip → `stash pop`, no conflicts) and one follow-on fix
   (`admin.spec.ts` needed `provideRouter([])` once `WallComponent` started injecting
   `ActivatedRoute` for the `?highlight=` feature). All criteria, including 6 and 7, verified.
2. **Three slices now edit `app.routes.ts` and (01/02 already) `app.config.ts`.** Each edit is
   one line; expected merge conflicts, not silent drops, as called out in slice 02's plan too.
3. **`AdminSessionStore` is unbounded and never cleared.** Every successful login (e.g. the
   instructor logging in on day 2, day 3, ...) adds another valid token that is never removed.
   Five logins over five days is nothing; flagged only so it isn't mistaken for a leak later —
   fixing it means adding the logout/expiry the spec explicitly decided to skip.
4. **`WallResource` now has two independent boolean gates (`includeHidden` param, cookie
   validity) collapsing into one effective flag.** Worth a code comment at that line — it's the
   one place a future reader could plausibly "simplify" by trusting the query param alone and
   reopen the hidden-content leak the spec calls out as the one thing this slice must not do.
5. **`@NameBinding` filters in Quarkus's RESTEasy Reactive need the annotation on the resource
   *method* (or class), not just present in the classpath.** Slices 04–07 must remember to
   write `@AdminOnly` on each new endpoint; nothing enforces that at compile time. Acceptable —
   the alternative (a path-prefix filter on `/api/admin/*`) fails differently (silently catches
   `/login`/`/session` too, requiring an exclusion list) rather than not at all.
