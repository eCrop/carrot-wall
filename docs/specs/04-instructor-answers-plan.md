# Plan: instructor answers

**Spec:** `docs/specs/04-instructor-answers.md` · **Intent:** `docs/intents/04-instructor-answers.md` · **Status:** awaiting approval

## Where this worktree starts from

New worktree `carrot-wall-slice-04`, branch `slice-04-instructor-answers`, **branched from
`slice-03-admin-gate` at `9a42200`** — the tip of slice 03 (admin passcode gate), now fully
implemented, committed (two commits: Phase A create API, Phase B `/admin` gate + wall reuse),
and rebased onto the current `slice-02-submit` (`4617826`, which itself carries slice-01 +
slice-02's Phase C wall integration). Everything this slice needs — `@AdminOnly`,
`AdminSessionStore`, `AdminResource`, `AdminComponent`, the `/admin` route, `Post`/`WallResource`
— exists on this one branch. No blocker, no phased "buildable now vs. later" split.

`origin/slice-03-admin-gate` still points at the pre-rebase commits — pushing the rebased
branch will need a force-push, but that's slice 03's housekeeping, not this slice's problem.

## What's already there, discovered while reading the code

- `Post.answer(String text)` already exists (sets `answerText` + `answerUpdatedAt = now()`), and
  `PostDto`/`wall.models.ts`'s `Post` already carry `answerText`/`answerUpdatedAt` end to end —
  `GET /api/wall` already returns an answer if one is set.
- `post-card.html` **already renders** the ✓ label and tinted answer block when
  `post().answerText` is present. Acceptance criteria 1, 2, 3 (read side) and most of 8 are
  already true today for any post whose `answer_text` is set directly in the DB.
- What's missing on the read side is narrower than the spec assumed: only the **answer
  timestamp** (relative/absolute per the spec's three-tier format) is unbuilt — today's card
  shows no timestamp for the answer at all, only for `createdAt`.
- `Post.answer(text)` does **not** implement clear-to-null: it unconditionally sets
  `answerText = text` and stamps `answerUpdatedAt`, so calling it with `""` stores an empty
  string and a fresh timestamp, not a clear of both. Needs fixing.
- `PostCardComponent` already has a second input besides `post` — `highlighted = input(false)`,
  from slice 02's submit-highlight ring — and `wall.html` already binds it:
  `<app-post-card [post]="post" [highlighted]="post.id === highlightedPostId()" />`. This is a
  direct, in-file precedent for adding a third input, `admin`.
- `AdminComponent`'s template (`admin.html`) renders the logged-in state as a bare `<app-wall />`
  with **no bindings at all** — that line is exactly where `[admin]="true"` goes.
- `WallComponent` has **zero inputs today**. Adding `admin = input(false)` is the first one.
- `AdminResource` (`@Path("/api/admin")`) has `@Produces(APPLICATION_JSON)` at the class level
  but **no class-level `@Consumes`** — only `login()` declares its own
  `@Consumes(APPLICATION_JSON)`. The new PUT method needs the same per-method annotation.
- `WallService.poll()` has **no in-flight guard**: `lastServerTime` is read before its `await`
  and written after, so an in-flight poll finishing late can upsert a stale `answerText` back
  over a card whose answer was just saved and immediately re-polled. This needs a fix (see
  decisions) for AC9/AC10 to hold reliably.

## Decisions this plan locks in

- **Clearing semantics live in `Post.answer(String)` itself, not the resource.** Blank or null
  in → `answerText = null; answerUpdatedAt = null`. Non-blank in → trimmed text + `now()`. One
  method, one place that can get this wrong, testable directly without HTTP or auth.
- **The answer endpoint is a new method on the existing `AdminResource.java`, not a new resource
  class.** `PUT /api/admin/posts/{id}/answer` fits the path family `AdminResource` already owns.
  It needs its own `@Consumes(APPLICATION_JSON)` (the class has none), `@AdminOnly` (confirmed
  usable on a single method — `session()` already does this), `@Transactional` (the
  `PostsResource.create()` precedent), and an `ApiError`-bodied 400 for the PT validation
  message, matching `PostsResource`'s style exactly.
- **Validation is manual, not Bean Validation, matching `CreatePostRequest`'s documented
  reasoning.** `answerText` must be trimmed before its length is checked (whitespace-only is
  blank), which `@Size`/`@NotBlank` can't do in one pass. `AdminAnswerRequest` stays a bare
  record with no annotations, same as `AdminLoginRequest` and `CreatePostRequest`.
- **The editor is a separate `AnswerEditorComponent` under `apps/web/src/app/admin/`, not
  inlined into `PostCardComponent`.** (Reversing an earlier draft of this plan, which had it
  inline.) `PostCardComponent` still renders `<app-answer-editor>` when `admin()` is true, so
  `post-card.spec.ts` ends up needing `provideHttpClient()`/`provideHttpClientTesting()` in its
  `TestBed` config too, for DI to resolve — that part of the original "zero-config" rationale
  didn't fully hold. What the split still buys, and what actually justifies it: `post-card.spec.ts`
  never needs the `settle()` macrotask dance `admin.spec.ts` requires (no `.then()` chain layered
  on the HTTP call to wait for, because nothing there triggers a request), `FormsModule` stays
  out of a component rendered once per card on every wall every 5s, and the editor's own
  expand/save/cancel/clear interactions live in one file (`answer-editor.spec.ts`) instead of
  bloating the public card's spec with save-flow tests it doesn't need.
  `PostCardComponent` gets one new input (`admin = input(false)`) and one new template block:
  `@if (admin()) { <app-answer-editor [post]="post()" /> }`.
- **`AnswerEditorComponent` follows `/post`'s existing form idiom**, not a new pattern: module-
  top constants for the char limit and PT error strings, `[ngModel]="text()"
  (ngModelChange)="text.set($event)"` (one-way + explicit setter, the same style `PostComponent`
  and `AdminComponent`'s PIN input both use), a `computed` remaining-characters counter mirroring
  `PostComponent.remaining`, and `imports: [FormsModule]`.
- **Saving refreshes via a fixed `WallService.poll()`, not a new local-upsert method.** After a
  successful `PUT`, the editor calls the admin's `WallService` instance's `poll()` once
  immediately (that instance is already its own component-scoped instance, provided in
  `AdminComponent`'s `providers` array per slice 03). Because `answer()` bumps `updated_at`, the
  normal `since=` delta already contains the change — no new service method needed. This only
  works safely once `poll()` is fixed to not race (next point).
- **`WallService.poll()` gets serialized, with the rejection case handled explicitly.** The
  naive fix — `this.polling = (this.polling ?? Promise.resolve()).then(() => this.doPoll())` —
  is a trap: once any `doPoll()` rejects, the stored promise is rejected forever, and every
  later `.then()` on it short-circuits without running — silently, because `WallComponent`'s
  `tick()` already swallows poll errors. The real fix chains through a `.catch(() => {})` (or
  resets the in-flight promise to `null` in a `finally`) so one failed fetch doesn't permanently
  kill polling. This is slice-01/02 debt, paid here because it's this slice's own acceptance
  criteria (AC9, AC10 — "within 5s... no reload... no reorder") that need it to actually hold.
- **The timestamp helper in `post-card.ts` gets a second, more general function
  (`formatAnswerTime`), not a rewrite of `formatRelativeTime`.** `formatRelativeTime` (used for
  `createdAt`) stays relative-only, matching the existing cards. `formatAnswerTime` adds the two
  absolute branches spec 04 asks for and is used only for `answerUpdatedAt`.
- **Endpoint returns 204, not the updated `PostDto`.** Returning the DTO would let the client
  upsert locally instead of polling, but that doesn't remove the need to fix `poll()`'s race
  (other admin actions — pin, hide, in slices 05/07 — will hit the same race), so fixing the
  shared service once is the smaller total diff than adding a local-upsert path here too.

## Order of work

**Phase A — the answer API.**

1. **`Post.java`** — fix `answer(String text)`: trim; blank/null → `answerText = null;
   answerUpdatedAt = null`; else → trimmed text + `LocalDateTime.now()`.
2. **`PostTest.java`** (new, `apps/api/src/test/java/pt/ecrop/wall/`) — plain unit test, no
   `@QuarkusTest` needed: `answer("x")` sets both fields; `answer("y")` after that replaces both;
   `answer("")`/`answer("   ")`/`answer(null)` clears both back to `null`.
3. **`AdminAnswerRequest.java`** (new) — record `(String answerText)`, mirrors
   `AdminLoginRequest`'s bare-record style.
4. **`AdminResource.java`** (edit) — add:
   ```java
   @PUT
   @Path("/posts/{id}/answer")
   @Consumes(MediaType.APPLICATION_JSON)
   @AdminOnly
   @Transactional
   public Response setAnswer(@PathParam("id") Long id, AdminAnswerRequest request) { ... }
   ```
   Look up the post (`Post.findById(id)`, 404 if null), trim `answerText` (empty string if
   null), reject over 1000 chars post-trim with `Response.status(BAD_REQUEST).entity(new
   ApiError("O texto da resposta pode ter no máximo 1000 caracteres."))`, else call
   `post.answer(trimmed)` and return 204. No explicit `persist()` — the entity is managed inside
   the `@Transactional` method.
5. **`AdminResourceTest.java`** (edit) — reuse the existing `static String login()` helper (adds
   a session cookie for these tests, exactly as `sessionCheckAcceptsTheCookieFromALoginJustPerformed`
   already does). New cases: set persists trimmed text + timestamp and shows up in `GET
   /api/wall`; replace overwrites; blank body clears both fields and removes them from the
   public read; over-1000 chars → 400, unchanged; no cookie → 401; unknown id → 404; none of the
   above touch a second, untouched post's `pinned`/`upvotes`/position in `GET /api/wall`.

**Phase B — public read-side: the answer timestamp.**

6. **`post-card.ts`** — add `formatAnswerTime(epochMillis: number): string`: `< 1h` → reuse the
   existing relative formatter's minute/second branches; same local calendar day → `HH:mm`
   (`Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' })`); else → `d MMM,
   HH:mm` (`Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' })` + the time
   formatter, joined with `", "`).
7. **`post-card.html`** — inside the existing `@if (post().answerText)` block, add the
   timestamp next to "✓ Resposta" using `formatAnswerTime(post().answerUpdatedAt!)`.
8. **`post-card.spec.ts`** (edit) — three new cases for `formatAnswerTime`'s boundaries (59 min
   → relative, just over 1h same day → `HH:mm`, previous day → `d MMM, HH:mm`). Build each
   test's expected string from `Intl.DateTimeFormat` itself rather than hardcoding a literal
   like `"18 set, 14:32"` — the month abbreviation's punctuation (`"set"` vs `"set."`) varies by
   ICU version, so a hardcoded literal is brittle across Node/CI versions.

**Phase C — the admin editor.**

9. **`WallService.ts`** (edit) — serialize `poll()` behind an in-flight guard with a terminal
   `.catch()`/`finally` reset, per the decision above.
10. **`wall.service.spec.ts`** (edit) — new case: reject the first `poll()`'s fetch, assert the
    second `poll()` still fires and resolves (proves the guard doesn't poison itself).
11. **`apps/web/src/app/admin/admin-posts.service.ts`** (new) — `setAnswer(id: number, text:
    string): Promise<void>` → `PUT /api/admin/posts/{id}/answer`, `firstValueFrom` +
    `HttpClient.put`, matching `AdminAuthService`'s style (no `catchError`-to-boolean here,
    since the editor needs to show the actual PT error on failure).
12. **`apps/web/src/app/admin/answer-editor.ts`/`.html`/`.scss`** (new) — `AnswerEditorComponent`:
    `post = input.required<Post>()`; collapsed "Responder" link (label flips to "Editar
    resposta" when `post().answerText` is set); click expands an inline `<textarea>` (pre-filled
    from `post().answerText`, 1000-char live counter via a `computed`, inline PT error over
    limit), Save/Cancel. Save calls `adminPostsService.setAnswer(...)` then
    `inject(WallService).poll()`; success collapses back to the link. Follows `/post`'s form
    idiom (see decisions).
13. **`apps/web/src/app/admin/answer-editor.spec.ts`** (new) — link renders and expands on
    click; prefills existing text; Save calls the service and collapses; clearing the textarea
    and saving triggers a clear call; over-1000 chars disables Save and shows the PT error, no
    call fires. Uses `admin.spec.ts`'s `provideHttpClientTesting()` + `settle()` pattern, since
    this component does its own HTTP.
14. **`post-card.ts`/`post-card.html`** (edit) — `admin = input(false)`;
    `@if (admin()) { <app-answer-editor [post]="post()" /> }`, imported alongside the existing
    template. `post-card.spec.ts` gains cases with `admin` true covering the same rendering
    checks (link present) without needing HTTP itself — the interaction tests live in
    `answer-editor.spec.ts`.
15. **`wall.ts`/`wall.html`** (edit) — `admin = input(false)` on `WallComponent`;
    `<app-post-card [post]="post" [highlighted]="..." [admin]="admin()" />`.
16. **`admin.html`** (edit) — `<app-wall [admin]="true" />`.

## Files

| File | Change | Phase | Why |
|---|---|---|---|
| `apps/api/.../wall/Post.java` | edit | A | clear-to-null semantics for `answer()` |
| `apps/api/src/test/.../PostTest.java` | new | A | unit-tests the entity method directly |
| `apps/api/.../wall/AdminAnswerRequest.java` | new | A | typed PUT body |
| `apps/api/.../wall/AdminResource.java` | edit | A | the answer endpoint |
| `apps/api/src/test/.../AdminResourceTest.java` | edit | A | full endpoint matrix |
| `apps/web/src/app/wall/post-card.ts`/`.html` | edit | B, C | answer timestamp; then `admin` input + editor slot |
| `apps/web/src/app/wall/post-card.spec.ts` | edit | B, C | timestamp tests; then admin-mode rendering |
| `apps/web/src/app/wall/wall.service.ts` | edit | C | `poll()` in-flight guard |
| `apps/web/src/app/wall/wall.service.spec.ts` | edit | C | poll-rejection-doesn't-poison test |
| `apps/web/src/app/wall/wall.ts`/`.html` | edit | C | `admin` input, thread to `<app-post-card>` |
| `apps/web/src/app/admin/admin-posts.service.ts` | new | C | `setAnswer` call |
| `apps/web/src/app/admin/answer-editor.ts`/`.html`/`.scss` | new | C | the Responder editor |
| `apps/web/src/app/admin/answer-editor.spec.ts` | new | C | editor interaction tests |
| `apps/web/src/app/admin/admin.html` | edit | C | `<app-wall [admin]="true" />` |

## Verification

**JUnit** (`./mvnw test`)
- `PostTest` — set, replace, clear (blank/whitespace/null) on the entity directly.
- `AdminResourceTest` — set/replace/clear round-trip through `GET /api/wall`; 400 over 1000
  chars; 401 with no session; 404 unknown id; `pinned`/`upvotes`/order untouched on a sibling
  post.

**Angular** (`npm test`)
- `post-card.spec.ts` — `formatAnswerTime` at the <1h / same-day / earlier-day boundaries; with
  `admin` true, the Responder link renders.
- `wall.service.spec.ts` — a rejected `poll()` doesn't block the next one.
- `answer-editor.spec.ts` — expand/collapse, prefill, Save persists and re-collapses with
  "Editar resposta", clearing removes the ✓ block, over-1000 chars blocks Save with the PT
  error and fires no HTTP call.

**Manual**
- Seed a post's `answer_text`/`answer_updated_at` directly in H2 at three ages (30 min ago,
  earlier today, two days ago) and confirm the three timestamp formats on `/`.
- Log into `/admin`, expand "Responder" on a card, save an answer: confirm it appears on that
  same card immediately (no reload) and on a second browser tab on `/` within ~5s; clear it and
  confirm the ✓ disappears in both places; try a 1001-char answer and confirm the inline error
  blocks Save; `curl` the endpoint with no cookie and confirm 401.
- 360px devtools width on the expanded editor: no horizontal scroll, textarea font ≥16px.

## Risks and open questions

1. **`Post.answer()`'s clear-semantics change is a behavior change to already-shipped code.**
   No existing test covers it (only `WallResourceTest`'s ordering/hidden cases exist today), and
   nothing else calls `answer()` yet, so the risk is low — but worth a grep at implementation
   time in case a slice 05/06/07 branch has since started calling it differently.
2. **`admin` input flag on `PostCardComponent` sets a pattern slices 05/07 will likely copy**
   for their own per-card controls (pin toggle, hide button). Not this slice's job to formalize
   that into a convention doc — just flagging it so whoever builds those isn't surprised to find
   the precedent already there.
3. **The `poll()` in-flight fix touches shared, already-tested code** (`WallService` is used by
   every route that renders the wall). The new test (step 10) is the guard against a regression
   there; run the full `wall.service.spec.ts` suite, not just the new case, before merging.
4. **`origin/slice-03-admin-gate` is behind the local rebased branch.** If slice 03's own PR
   gets force-pushed and its commit hashes change after this worktree is cut, this branch's
   history will need a rebase too — a one-time cost, flagged so it isn't a surprise.
