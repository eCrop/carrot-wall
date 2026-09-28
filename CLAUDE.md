# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Carrot Wall — a live Q&A/feedback wall for a 5-day Claude Code masterclass. Attendees post
from their phones, the instructor answers/pins from `/admin`, a projector shows `/tv`.
Portuguese UI. **The spec is the source of truth: `spec.md`**
(features F1–F8, acceptance criteria, design tokens). `feature-ideas.md` is the
challenge backlog. `setup-docs/` holds the course guides that drove the original build.

**F1–F8 are all built** (wall, submit, admin passcode gate, answers, pin/hide, upvotes,
prompt-of-the-moment, TV mode), each landed as its own `slice-NN-*` branch/PR per
`docs/intents/README.md`'s dependency order, plus a `/materials` tab (not in the original
spec) linking course materials. `docs/intents/` and `docs/specs/` hold the design trail for
each slice — read the relevant one before touching that area, since it explains *why* a
feature works the way it does, not just what it does. New feature work follows the same
loop: `/spec` → `/plan` → implement → `/ship`.

## Commands

```bash
cd apps/api && ./mvnw quarkus:dev          # API, port 8080 (first run downloads a lot)
cd apps/web && npm start                   # web, port 4200
cd apps/api && ./mvnw test                 # JUnit
cd apps/api && ./mvnw test -Dtest=ClassName#methodName      # single test
cd apps/web && npm test                    # vitest + jsdom, unit tests beside each component
cd apps/web && npx ng test --filter '^App' # single test/suite (regex on test names)
cd apps/web && npx ng test --include src/app/app.spec.ts         # single file
cd apps/web && npm run e2e                 # Playwright (apps/web/e2e/); boots both servers itself
cd apps/web && npx prettier --check .      # no eslint / `npm run lint` in this repo
```

Only env var: `ADMIN_PIN` (defaults to `0000` in dev). Needs Java 21 (matches
`apps/api/pom.xml`'s `maven.compiler.release`) and Node ≥22.22.3/24.15.0/26.0.0 (Angular CLI
22's floor). `mise.toml` at the repo root pins both — run `mise install` once, or `mise exec --
<cmd>` per command if your shell isn't mise-activated.
A `PreToolUse` hook in `.claude/settings.json` blocks edits to existing Flyway migration files;
a `PostToolUse` hook prettier-formats every `.ts`/`.html`/`.scss`/`.json` file after it's written.

## Target shape

- `apps/web` — Angular 22 standalone components + Angular Material, TS 6. Routes: `/` wall,
  `/post` submit, `/tv` projector, `/admin`, `/materials`. Polls the API every 5s; no
  websockets. `npm start` proxies `/api` to port 8080 via `proxy.conf.json` (already wired
  into `angular.json` → `serve.options.proxyConfig`), so there is no CORS layer in dev either.
- `apps/api` — Quarkus 3.39 / Java 21. REST resources (`WallResource`, `PostsResource`,
  `AdminResource`) + Bean Validation + Panache entities (`Post`, `Prompt`, `PromptPreset`).
  H2 **file** DB in PostgreSQL mode; **Flyway owns the schema**
  (`quarkus.hibernate-orm.schema-management.strategy=none`), `%test` profile uses in-memory H2
  so `./mvnw test` never collides with a running dev server.
- Production is **one container** (root `Dockerfile`): the Angular build lands in the Quarkus
  jar's `META-INF/resources`, both served on port 8080. `SpaRoutes.java` reroutes `/post`,
  `/tv`, `/admin` and `/materials` to `index.html` so a refresh does not 404 — add any new
  route there too.

## Architecture notes that span multiple files

- **The poll delta.** `GET /api/wall` is one endpoint with three modes selected by query
  params — no params (page 1: pinned posts + newest page of unpinned), `before`/`beforeId`
  ("load more" pagination), `since` (everything changed at or after that server timestamp).
  One endpoint rather than three so there's a single place that applies the hidden-post
  filter. `WallService` (apps/web) mirrors this: posts live in an id-keyed `Map` signal, not
  an array, so a poll's upsert/remove never needs to know list position; display order is a
  `computed()` sort (pinned first, then newest), recomputed every time rather than
  maintained. `poll()` queues a second call rather than firing a concurrent request when one
  is already in flight, so an admin save's immediate poll can't be clobbered by a slower
  earlier one.
- **Admin auth.** `AdminResource.login` sets an `admin_session` cookie backed by
  `AdminSessionStore` (in-memory token set — one instructor, no expiry, resets on redeploy by
  design). The `@AdminOnly` annotation + `AdminAuthFilter` (a JAX-RS `ContainerRequestFilter`)
  enforce the 401 once, centrally, rather than per-resource-method. `GET /api/wall` itself
  stays unauthenticated (attendees poll it every 5s) but only honors `includeHidden=true` when
  the request's cookie validates against `AdminSessionStore` — the query param alone is never
  trusted.
- **Rate limiting is per-browser, not per-IP.** The whole classroom sits behind one public IP
  on Railway, so `RateLimiter` (apps/api) keys on a client-supplied `X-Client-Token` header
  instead — see `client-token.ts` (apps/web), which mints a `localStorage` UUID with an
  in-memory fallback for private browsing. A request with no token is never blocked; the
  header is a friendly-room guard, not authentication. The same token pattern backs the
  one-upvote-per-post guard.
- **`Post` mutations are named methods** (`pin`, `unpin`, `hide`, `unhide`, `upvote`,
  `answer(text)`), each going through `@PreUpdate` so `updatedAt` moves — that's what makes a
  row show up in the next poll's `since` delta. See the Conventions rule below on bulk updates.

## Conventions

- **Never edit an existing Flyway migration** — add a new versioned file. Migrations live in
  `apps/api/src/main/resources/db/migration/` (currently V1–V6) and are deliberately split
  into a story (V1 posts → V2 answers/moderation → V3 prompts+seed → V4/V5 `updated_at` →
  V6 prompt presets), because Day 1's exercise is "explain the migrations." Keep the SQL
  portable across H2-PG mode and real Postgres: no `JSONB`, no arrays.
- **Never mutate a `Post` via a bulk `update(...)` string** (e.g. Panache's
  `Post.update("upvotes = upvotes + 1 where id = ?1")`). Bulk updates bypass the entity's
  `@PreUpdate`, leaving `updated_at` stale and making the change invisible to every polling
  client. Use the entity's mutation methods (`pin()`, `hide()`, `upvote()`, `answer(text)`) —
  load the row, call the method, let the flush happen.
- **Post messages render as text, never HTML.** Angular interpolation only, no `[innerHTML]`
  anywhere — acceptance criterion 12 is an XSS check.
- Every new endpoint validates its input with Bean Validation annotations.
- Hidden posts are a soft delete: excluded from every public response, never deleted from the DB.
- Admin routes and admin API endpoints return 401 without the PIN session cookie.
- `docs/intents/` holds `spec.md` cut into eight buildable slices, in dependency order — start
  there, not at the spec, when picking up work on an existing feature. New feature specs go in
  `docs/specs/`, named `<NN>-<feature-name>.md` matching the intent's number and slug
  (`docs/intents/02-submit-a-post.md` → `docs/specs/02-submit-a-post.md`); a plan for that
  slice is the same name with `-plan` appended (`02-submit-a-post-plan.md`).
- Tests: JUnit beside the resource, Angular unit tests beside the component, Playwright e2e in
  `apps/web/e2e/`. A change isn't done until `./mvnw test` and `npm test` both pass.
- Slice work happens on `slice-<NN>-<slug>` branches, stacked on their predecessor slice's
  branch (not always `master`) until that predecessor merges — see `.claude/commands/ship.md`
  for the exact base-branch logic and `.claude/commands/cleanup-worktree.md` for teardown.
  `.claude/commands/migration.md`, `plan.md`, and `spec.md` cover the rest of the per-slice loop.
- Design tokens (ivory `#FAF9F5`, ink `#141413`, coral `#D97757`, hairline borders, no drop
  shadows, serif headings + Inter) are in spec §4 — `DESIGN.md` at the root has the full system.
