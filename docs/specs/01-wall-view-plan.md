# Plan: wall view (`/`)

**Spec:** `docs/specs/01-wall-view.md` · **Intent:** `docs/intents/01-wall-view.md` · **Status:** awaiting approval

## Decisions this plan locks in

- **§7.13 answer: cursor-based "load more", 30 unpinned per page.** Not pagination, not a cap.
  Pinned posts ride on page 1 only; the cursor walks unpinned posts exclusively, so page 2
  can never duplicate or drop a pinned card.
- **Cursor is `(created_at, id)`, not `created_at` alone.** The V3 seed backdates eleven rows
  with minute-granularity intervals; two posts sharing a timestamp would make a bare
  `created_at` cursor skip or repeat a row. `id` breaks the tie for free.
- **`since=` uses `>=`, and the client merges by id.** A `>` comparison drops anything written
  in the same millisecond as the returned `serverTime`. `>=` re-sends at most a handful of
  rows the client already has, and an idempotent id-keyed merge makes that a non-event.
- **`serverTime` comes from the database clock**, the same source as `created_at` and
  `updated_at`, so there is no JVM-vs-DB skew to reason about.
- **Mutations are methods on `Post` — `post.upvote()`, `post.pin()`, `post.answer(text)` —
  not bulk `Post.update("...")` strings.** JPA bulk updates bypass `@PreUpdate`, so
  `UPDATE posts SET upvotes = upvotes + 1` would leave `updated_at` stale and make the change
  invisible to every polling client. Slices 04–06 get an obvious correct thing to call, so
  there is no reason to reach for the bulk form. A shape beats a convention nobody reads.
  A DB trigger would close this properly but is not portable in one file: H2 needs a Java
  class or `CALL`, Postgres needs plpgsql.
- **`serverTime` and `since` travel as epoch millis (a JSON number), not a datetime string.**
  No parsing on the client, no timezone, and no millisecond truncation through Jackson.
- **Fades are CSS, not `@angular/animations`.** The package is not installed and a 200ms
  opacity transition does not justify adding it.

## Order of work

Each step ends green. Steps 1–4 are the API, 5–9 the web app; they only meet at step 8.

**1. V4 migration** — `V4__post_updated_at.sql`: add `posts.updated_at TIMESTAMP NOT NULL`
(backfilled from `created_at`) and `CREATE INDEX idx_posts_updated_at ON posts (hidden, updated_at)`
— composite, because the `since` query filters `hidden = false` too, mirroring V2's
`idx_posts_visible`.
First because everything downstream reads it. *Verify:* `./mvnw quarkus:dev` boots and Flyway
logs "now at version v4".

**2. Entities** — `Post.java`, `Prompt.java` as Panache entities. `updated_at` is maintained by
a `@PrePersist`/`@PreUpdate` pair on `Post`, so no future slice can forget to bump it. This is
the load-bearing bit: slices 04–06 all write to posts, and a missed bump means a silent
poll miss.

**3. Repository queries** — three finders on `Post`: page 1 (pinned + newest 30 unpinned),
`before` (next 30 older unpinned), `since` (created-or-updated ≥ t). `hidden = false` lives in
every one of them, in SQL. For `since`, hidden posts are queried *separately* by id only, to
build `removedIds`.

**4. `WallResource`** — `GET /api/wall` with optional `before` / `since`, plus DTOs. One
endpoint, three modes, because the response shape is the same list-plus-prompt-plus-serverTime
in all three; separate paths would be three places to forget the hidden filter.
*Verify:* JUnit (below) + `curl localhost:8080/api/wall | jq`.

**5. Theme and shell** — replace the Material cyan/orange theme in `styles.scss` with spec §4
tokens, wire Google Fonts (serif + Inter) in `index.html`, gut the Angular placeholder markup
in `app.html` down to `<router-outlet />`, and add `provideHttpClient()` to `app.config.ts`
(absent today — nothing can call the API without it). This is the step later slices inherit.

**6. `WallService`** — typed `httpResource`/`HttpClient` calls, and the merge logic: a signal
holding an id-keyed map of posts, `loadMore()` appending by cursor, `poll()` applying a delta
(upsert changed, delete `removedIds`, swap the prompt). Pure TS, unit-testable without a DOM —
this is where the subtle bugs will live, so it gets tested on its own.

**7. `PostCardComponent`** — type chip, message, name or "Anónimo", relative time, upvote
count, 📌, answer block. Interpolation only.

**8. `WallComponent`** — prompt banner, responsive CSS grid (1/2/3), "load more" button,
empty state, the 5s poll wired to `WallService`. Route `/` in `app.routes.ts`.

**9. Polish** — 150–250ms fade-in on new cards, 360px pass, PT microcopy. The fade depends on
step 6's merge being id-keyed with `@for (... track post.id)`: Angular then reuses DOM for
existing cards and only new ones enter. If the merge rebuilds the array instead, every card
re-enters and the whole wall flashes on every poll.

## Files

| File | Change | Why |
|---|---|---|
| `apps/api/.../db/migration/V4__post_updated_at.sql` | new | `since=` needs a timestamp that moves on *every* write; only `answer_updated_at` exists today |
| `apps/api/.../wall/Post.java`, `Prompt.java` | new | Panache entities; `@PreUpdate` keeps `updated_at` honest |
| `apps/api/.../wall/WallResource.java` | new | the read endpoint |
| `apps/api/.../wall/WallResponse.java` (+ `PostDto`, `PromptDto`) | new | keeps `hidden` off the wire entirely rather than trusting a serializer annotation |
| `apps/api/src/test/java/.../WallResourceTest.java` | new | first real JUnit test in the repo (§7.15) |
| `apps/web/src/styles.scss` | rewrite theme | Material default is cyan/orange; spec §4 is ivory/ink/coral |
| `apps/web/src/index.html` | edit | Google Fonts links |
| `apps/web/src/app/app.config.ts` | edit | add `provideHttpClient()` — missing today |
| `apps/web/src/app/app.html`, `app.scss`, `app.ts` | strip | delete the Angular welcome placeholder |
| `apps/web/src/app/app.routes.ts` | edit | `''` → `WallComponent` |
| `apps/web/src/app/wall/wall.ts/.html/.scss` | new | the page |
| `apps/web/src/app/wall/post-card.ts/.html/.scss` | new | the card |
| `apps/web/src/app/wall/wall.service.ts` | new | fetch + merge |
| `apps/web/src/app/wall/*.spec.ts` | new | component + service tests |
| `apps/web/src/app/app.spec.ts` | delete | it asserts on the deleted placeholder markup; once `App` is a bare `<router-outlet />` a rewritten version would only assert that an outlet exists. The wall specs carry §7.15. Deleted in the same step the wall specs land, so `npm test` is never red-with-no-coverage |
| `docs/intents/01-wall-view.md` | edit | its "no migration" line becomes false at step 1 |

## Verification

**JUnit** (`./mvnw test`)
- Pinned post precedes every unpinned post in page 1 (§7.3).
- A `hidden = true` post is absent from page 1, from `before`, and from `since` — asserted on
  the JSON body, not a Java list.
- `since` returns a post whose only change was `pinned`, and one whose only change was
  `upvotes` — this is the assertion that catches a forgotten `updated_at` bump. **These tests
  must mutate through the entity** (`Post.findById(id)`, set field, flush), not via raw SQL:
  raw SQL would set `updated_at` by hand and prove nothing about the production path. There is
  no admin or upvote endpoint yet, so the entity path is what stands in for slices 04–06.
- `since` returns a newly-hidden post's id in `removedIds`, with no message text anywhere in
  the body.
- `before` with the cursor from page 1 returns the next 30 with zero id overlap.

**Angular** (`npm test`)
- Card renders name, "Anónimo" when name is null, type chip, relative time, upvote count.
- A message containing `<script>alert(1)</script>` appears as literal text and creates no
  `script` element (§7.12).
- Empty state renders when the list is empty.
- Service merge: delta upserts by id, `removedIds` deletes, duplicate ids from a `>=` overlap
  do not duplicate cards.

**Manual**
- Fresh clone, two commands, seeded posts visible on first load (§7.14).
- `INSERT` a post via H2 → it fades in at the top within 5s without a reload (§7.2, partial).
- With the browser scrolled to page 3: `UPDATE posts SET upvotes = 99 WHERE id = <deep id>` →
  the count changes in place within 5s. Then `SET hidden = TRUE` → the card vanishes.
- `UPDATE prompts` / insert a newer prompt → banner swaps quietly on the next poll.
- 360px in devtools: one column, readable, no horizontal scroll.
- DevTools network: the poll payload stays small with 3 pages loaded.

## Risks and open questions

1. **A future slice forgets to bump `updated_at` and the poll silently goes stale.** The sharp
   edge is JPA bulk updates: `Post.update("upvotes = upvotes + 1 where id = ?1")` is the
   obvious way to write slice 06 and it bypasses `@PreUpdate` completely — the wall would go
   stale on the one path most likely to use it, and entity-path tests would not catch it.
   Mitigated by (a) `@PreUpdate` on the entity, (b) the written convention above, enforced in
   CLAUDE.md, (c) the two `since` tests going through the entity path. Still the most likely
   way this design breaks; a DB trigger would close it properly but costs the H2/Postgres
   portability constraint.
2. **200-post load test needs 200 posts.** The seed has 11. A throwaway `scripts/seed-200.sql`
   piped into H2 at verification time — never a migration, which would ship 200 fake posts to
   the room on Monday, and not a `%dev` fixture, which is more machinery than one check needs.
3. **`app.spec.ts` is deleted, not rewritten.** Verify that `@angular/build:unit-test` errors
   rather than passes on zero spec files — irrelevant if the delete is sequenced with the wall
   specs (step 6/7), which is why it is.
4. **Uneven card bottoms.** Plain grid means a one-line post and a four-line post share a row
   height. Per spec §4, whitespace is doing the structure — but if it reads as broken rather
   than calm at step 9, the fallback is round-robin flex columns, not `column-count`.
5. **Relative time ("há 5 min") needs a PT formatter.** `Intl.RelativeTimeFormat` with `pt-PT`
   covers it — no dependency.
6. **`e2e/` is not created here.** Spec §6 wants a Playwright submit-and-see-it-appear test;
   that flow does not exist until slice 02. Intentionally deferred.
