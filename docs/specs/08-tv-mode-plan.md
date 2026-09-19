# Plan: TV mode (`/tv`)

**Spec:** `docs/specs/08-tv-mode.md` · **Intent:** `docs/intents/08-tv-mode.md` · **Status:** implemented, pending 07's merge (see "done gate" below)

## Where this worktree starts from

`slice-07-prompt-of-the-moment` shipped as PR #8 (`33970fb`), based on `slice-06-upvotes`
(PR #7) → `slice-05-pin-and-hide` (PR #6) → `master`. `carrot-wall-slice-08` / branch
`slice-08-tv-mode` was cut from its tip, which carries `PinnedCarouselComponent` (05), upvotes
(06) and prompt activation (07) — everything `/tv` depends on.

**Done gate:** none of 05/06/07/08 is merged to `master` yet. This slice's tests are green
against 07's tip, but per instruction it is not considered finished until 07 merges, at which
point this branch pulls the merged result, re-runs `./mvnw test` / `npm test` /
`npx playwright test`, and repeats the manual projector checks.

## What's already there, discovered while reading the code

- `GET /api/wall` (slice 01) already returns everything `/tv` needs — prompt, pinned-first
  sorted posts, `since=` deltas, `removedIds` — with zero backend changes required.
  `WallService` (`apps/web/src/app/wall/wall.service.ts`, `providedIn: 'root'`) exposes
  `posts` (already sorted pinned-first-then-newest), `prompt`, `loaded`, and `loadFirstPage()`/
  `poll()` — the exact same singleton `WallComponent` uses. `/tv` injects it directly and
  reuses `WallComponent.tick()`'s poll-loop pattern; no new service.
- `SpaRoutes.java` **already lists `/tv`** in its SPA fallback array — no backend file needs to
  change at all for this slice.
- **`PinnedCarouselComponent` (`apps/web/src/app/wall/pinned-carousel.ts`, slice 05) already
  implements the cycling `/tv` needs** — `posts` input, `chunk()` into pages, `setInterval`
  advance, clamp-on-shrink `effect`, dot navigation, pause on hover/focus, `OnPush` — and its own
  doc comment states it exists "so slice 08's `/tv` can reuse it unchanged with a different
  `posts` source." **`/tv` reuses this component rather than reimplementing cycling.**
- `PostCardComponent` already renders every field `/tv` needs (type chip, message, name/
  "Anónimo", relative time, upvotes, answer block, 📌 marker) via interpolation only — reusing
  it for the large-type cards means the XSS acceptance criterion is already covered by
  `post-card.spec.ts` and doesn't need a duplicate test.
- No QR-code capability exists anywhere in the repo. Checked `npm view qrcode-generator`:
  MIT-licensed, **zero runtime dependencies**, exposes a low-level API (`getModuleCount()`,
  `isDark(row, col)`) rather than only HTML/canvas helpers — the module grid can be rendered as
  inline SVG `<rect>`s via `@for`, keeping the codebase's "no `[innerHTML]` anywhere" rule intact
  instead of using the library's own `createSvgTag()`/`createImgTag()` (which return HTML
  strings).
- `post-card.scss` sets no explicit `font-size` on `.post-card__message` — the large-type
  requirement needs a new CSS variant, not a rewrite.
- 07's own plan (`docs/specs/07-prompt-of-the-moment-plan.md`) contains **zero** mentions of
  `/tv`. Its spec/intent nonetheless place three duties on `/tv` (six-metre banner legibility,
  activation reaching `/tv` within a poll cycle — AC4, XSS-safe prompt rendering — AC7) that
  07's plan never implements, since `/tv` doesn't exist when 07 is built. This slice absorbs
  them as its own acceptance criteria and tests (see spec's "Inherited from slice 07").

## Decisions this plan locks in

- **`/tv` is a new standalone route/component, not a mode flag on `WallComponent`.** Unlike
  `admin` (which reuses `<app-wall>` wholesale), `/tv`'s layout — one pinned slot, a 3-card
  page, no "load more", no grid — is structurally different enough that threading it through
  `WallComponent`/`wall.html` would mean branching most of that template. `TvComponent` gets
  its own `.ts`/`.html`/`.scss` under `apps/web/src/app/tv/`, injecting the same root
  `WallService` singleton `WallComponent` uses.
- **`PostCardComponent` gets one more input, `tv = input(false)`**, following the exact
  precedent `admin = input(false)` set in slice 04: `[class.post-card--tv]="tv()"` on the root
  element, a new `.post-card--tv` SCSS block bumping message/type/footer font sizes to clear
  32px per the design table below.
- **`PinnedCarouselComponent` gets three optional inputs, all defaulting to today's behavior**
  so `/` is unaffected:
  - `pageSize = input(3)` — replaces its internal `PAGE_SIZE` constant.
  - `intervalMs = input(6000)` — replaces `ADVANCE_INTERVAL_MS`.
  - `interactive = input(true)` — when `false`, no dot buttons render and no
    `(mouseenter)/(focusin)` pause bindings are attached. `/tv` must have **zero** interactive
    elements, and a mouse resting on the podium must not freeze the projector's rotation.
  `/tv` uses two instances: the pinned slot (`[pageSize]="1" [intervalMs]="8000"
  [interactive]="false"`) and the unpinned row (`[pageSize]="3" [intervalMs]="8000"
  [interactive]="false"`). Both already render nothing for an empty `posts` array, which gives
  "no pinned posts → no pinned slot" for free. Both pass `[tv]="true"` through to the cards they
  render.
- **The QR module matrix is computed once per render via a small wrapper, `qr.ts`**:
  `buildQrCells(text: string): boolean[][]` calls `qrcode-generator`, iterates
  `getModuleCount()`, and returns a plain boolean grid. `tv.html` turns that into an SVG with a
  `@for` over rows and columns, each dark cell a `<rect>`, `viewBox` set to the module count so
  it scales crisply — the ≥180px constraint is enforced by container CSS, not SVG intrinsic
  size. Text encoded is `${location.origin}/post`, computed once (not reactive).
- **Design is TV-scoped from `DESIGN.md`** (repo root — copied in as part of this slice), not
  the global `--wall-*` tokens. `/`, `/post`, `/admin` keep their current look; `tv.scss`
  declares its own values. See the spec's Design section for the token table.
- **No dark full-screen variant, no admin/interactive affordances, no `/api/wall` changes** —
  confirmed out of scope.

## Order of work

**Phase 0 — base.** ✅ Confirmed `slice-07-prompt-of-the-moment` exists and carries 05's
carousel. Cut `carrot-wall-slice-08` / `slice-08-tv-mode` from its tip. Copied the design
export to the repo root as `DESIGN.md`, added Cormorant Garamond to the existing Google Fonts
`<link>` in `index.html`.

**Phase A — shared components**

1. `apps/web/src/app/wall/pinned-carousel.ts`/`.html` — add `pageSize`, `intervalMs`,
   `interactive`, `tv` inputs per the decisions above.
2. `apps/web/src/app/wall/pinned-carousel.spec.ts` (edit) — defaults unchanged (3 / 6000ms /
   dots present); `pageSize=1` pages one at a time; `interactive=false` renders no `<button>`
   and does not pause on `focusin`.
3. `apps/web/src/app/wall/post-card.ts` — add `tv = input(false)`.
4. `apps/web/src/app/wall/post-card.html` — add `[class.post-card--tv]="tv()"`.
5. `apps/web/src/app/wall/post-card.scss` — `.post-card--tv` block per the design table:
   message ≥32px, scaled-up type chip/footer/answer text, more padding.
6. `apps/web/src/app/wall/post-card.spec.ts` (edit) — `tv` input toggles the class; existing
   cases untouched.

**Phase B — QR**

7. Add `qrcode-generator` to `apps/web/package.json`, run `npm install`.
8. `apps/web/src/app/tv/qr.ts` (new) — `buildQrCells(text: string): boolean[][]`.
9. `apps/web/src/app/tv/qr.spec.ts` (new) — matrix is square, side length matches
   `getModuleCount()`, at least one `true` cell, deterministic for the same text.

**Phase C — the route**

10. `apps/web/src/app/tv/tv.ts` (new) — `TvComponent`: injects `WallService`; `prompt`
    passthrough; `pinnedPosts`/`unpinnedPosts` computed filters over `wallService.posts()`; a
    5s poll loop copied from `WallComponent.ngOnInit`/`tick()` (same swallow-and-retry error
    handling); `qrCells`/`postUrl` computed once.
11. `apps/web/src/app/tv/tv.html` (new) — serif prompt banner; two `<app-pinned-carousel>`
    instances (pinned slot, unpinned row) per the decisions above; QR `<svg>` block built from
    `qrCells()` in a dark corner tile, ≥180px via CSS. No buttons, links, or `(click)` handlers
    anywhere.
12. `apps/web/src/app/tv/tv.scss` (new) — the design table in the spec: TV-local custom
    properties, serif banner, 3-column card row, fixed-position QR corner.
13. `apps/web/src/app/tv/tv.spec.ts` (new) — see Verification below.
14. `apps/web/src/app/app.routes.ts` (edit) — add `{ path: 'tv', component: TvComponent }`.

**Phase D — e2e + docs**

15. `apps/web/e2e/tv-mode.spec.ts` (new) — see Verification.
16. Update `docs/specs/08-tv-mode.md`/`08-tv-mode-plan.md` `Status` to reflect what shipped, if
    it diverges from this plan.

## Files

| File | Change | Phase | Why |
|---|---|---|---|
| `DESIGN.md` (repo root) | new | 0 | TV-scoped design source, per CLAUDE.md's "follow DESIGN.md if it appears at the root" |
| `apps/web/src/app/wall/pinned-carousel.ts`/`.html` | edit | A | `pageSize`/`intervalMs`/`interactive`/`tv` inputs; defaults unchanged |
| `apps/web/src/app/wall/pinned-carousel.spec.ts` | edit | A | covers the new inputs |
| `apps/web/src/app/wall/post-card.ts`/`.html`/`.scss` | edit | A | `tv` input + large-type variant |
| `apps/web/src/app/wall/post-card.spec.ts` | edit | A | covers the new class toggle |
| `apps/web/package.json`(+lock) | edit | B | add `qrcode-generator` |
| `apps/web/src/app/tv/qr.ts` | new | B | module-grid wrapper, no `innerHTML` |
| `apps/web/src/app/tv/qr.spec.ts` | new | B | matrix shape/determinism |
| `apps/web/src/app/tv/tv.ts`/`.html`/`.scss` | new | C | the route component |
| `apps/web/src/app/tv/tv.spec.ts` | new | C | full component behavior (below) |
| `apps/web/src/app/app.routes.ts` | edit | C | registers `/tv` |
| `apps/web/e2e/tv-mode.spec.ts` | new | D | end-to-end submit → appears on `/tv` |

No `apps/api` files change — `SpaRoutes.java` already covers `/tv`, and no schema/endpoint work
is needed.

## Verification

**Angular unit tests** (`npm test`)
- `pinned-carousel.spec.ts` — defaults preserved; `pageSize=1` pages one at a time;
  `interactive=false` → no `<button>`, no pause on `focusin`.
- `post-card.spec.ts` — `tv` input toggles the class.
- `qr.spec.ts` — matrix shape and determinism.
- `tv.spec.ts` (12 cases; **deviates from the original plan** — see note below):
  - renders the prompt banner from `WallService.prompt()`.
  - a prompt containing `<script>alert(1)</script>` renders as literal text (07 AC7).
  - a changed `prompt` signal (simulating 07's activation reaching the poll) swaps the banner
    within one poll (07 AC4).
  - 0 pinned posts → no pinned slot rendered.
  - posts split correctly into the pinned vs. unpinned carousel.
  - a post added via a poll delta appears in `unpinnedPosts()` immediately (intent: "cycling
    must not hide new posts").
  - a post removed via a poll delta disappears from `unpinnedPosts()`.
  - **the pinned carousel is wired with `pageSize=1`, `intervalMs=8000`, `interactive=false`**,
    and the unpinned one with `pageSize=3` — via
    `fixture.debugElement.query(By.css('.tv-pinned')).injector.get(PinnedCarouselComponent)`.
  - no `<button>`, `<a>`, or `[href]` anywhere in the rendered DOM.
  - a QR `<svg>` renders with a non-empty set of `<rect>` cells.
  - empty wall → the PT invitation line renders.

  **Deviation from the plan:** the original plan called for re-simulating the full 8s
  pinned-rotation and unpinned-paging cycle inside `tv.spec.ts` with `fakeAsync`/`tick(8000)`.
  In practice this duplicated `pinned-carousel.spec.ts`'s own coverage (which already proves
  paging/rotation for arbitrary `pageSize`/`intervalMs`, added in Phase A) and turned out
  fragile: `/tv`'s independent 5s poll interval and the carousel's 8s interval cross each
  other's boundaries inside the same `advanceTimersByTime` window, requiring the extra drain
  logic below; combined with sort-order ties in hand-built fixtures, expected page contents
  stopped being obvious. Replaced with the wiring-assertion approach above — it proves `/tv`
  configures the shared, already-tested component correctly, without re-testing the component's
  internals. The intent's "must not hide new posts" constraint is instead proven at the data
  layer `PinnedCarouselComponent` actually reads (`unpinnedPosts()`), which is where the
  guarantee has to hold for the timing-level behavior to work at all.

**Playwright e2e** (`npx playwright test`, new `tv-mode.spec.ts`) — all 3 passing, plus the
existing 4 `submit-post.spec.ts` cases, run together (7/7):
- Submit a post via `/post` (same pattern as `submit-post.spec.ts`), then navigate to `/tv` and
  assert the message becomes visible within a window comfortably longer than 5s poll + 8s
  cycle (`{ timeout: 20_000 }`) — covers spec §7.15/intent's required e2e check. In practice the
  post is already in the first `/api/wall` response `/tv` loads, so this resolves in under a
  second rather than needing the full window — the generous timeout is a safety margin, not the
  expected path.
- Assert the message element's computed `font-size` is ≥32px.
- Assert the QR container's rendered box is ≥180px in both dimensions.

One flake surfaced and was fixed during implementation: this test's `Date.now()`-based message
and `submit-post.spec.ts`'s own `Date.now()`-based message collided under Playwright's parallel
workers (a case-insensitive substring match — `"E2E post 123"` inside `"TV e2e post 123"` —
when both landed on the same millisecond), making the *other* test's card-lookup match two
cards. Fixed by giving this test's message distinct wording (`"Mensagem da projeção ..."`)
instead of a shared prefix.

**Manual**
- Run both dev servers, open `/tv` at a realistic projector resolution (1920×1080), confirm
  layout doesn't overflow or scroll.
- Scan the QR with a phone camera and confirm it lands on `/post`.
- Watch a full cycle with 2 pinned + 5+ unpinned seeded posts: confirm the pinned slot and the
  3-card row both advance every ~8s, and nothing is clickable (click around the screen, nothing
  happens); leave the mouse resting over a card and confirm the rotation does **not** freeze.
- Change the active prompt from `/admin` (slice 07's selector, once it exists) and confirm
  `/tv`'s banner swaps within a poll cycle.
- Insert a new post directly into the DB mid-cycle and confirm it appears within one poll +
  one page turn, never silently dropped.
- Hide a post currently on screen and confirm it disappears before its next scheduled turn.
- Stand back ~6m (or shrink the browser) and confirm the banner and messages are legible — the
  07 intent's legibility bar.

`./mvnw test` is run as a sanity check (unaffected, since no `apps/api` file changes) alongside
`npm test` and `npx playwright test`.

## Risks and open questions

1. **Reduced motion is deliberately overridden on `/tv`** (per decision above): `interactive`
   false bypasses the `prefers-reduced-motion` skip, so the projector always cycles even if the
   TV machine has that OS setting on. This is intentional — a frozen, unreadable-past-page-1
   screen with no controls is worse than motion no one there needs an accessible alternative to
   — but flag it to the room operator as a deliberate exception, not an oversight, if it's ever
   questioned.
2. **8s/3-cards-per-page/1-pinned-slot are still guesses**, same as the intent flagged for the
   8s number alone. They're component inputs now (`pageSize`/`intervalMs` on both carousel
   instances in `tv.html`), so tuning during the course week is a one-line change.
3. **`qrcode-generator` ships its own typings** (`dist/qrcode.d.ts`, verified) — no `@types`
   package or ambient declaration needed. Resolved during implementation.
4. **Page boundaries shift when the pool grows mid-cycle** (a consequence of computing pages off
   the live signal, which is exactly what makes mid-cycle inserts work). Accepted behavior, not
   a bug — worth calling out so it isn't reported as one later.
5. **Editing `pinned-carousel.ts`/`.html`/`.spec.ts` and `post-card.ts`/`.html`/`.scss`/`.spec.ts`
   touches files that PRs #6/#7/#8 also touch.** All additive (new inputs with unchanged
   defaults, a new CSS block, one new template branch) so a rebase once those merge should be
   mechanical, but worth double-checking at merge time.
6. **A `Date.now()`-based e2e test message collided with an existing one under parallel
   workers** (see the Playwright section above) — fixed, but a reminder that any future e2e
   test adding a `Date.now()`-suffixed message should use clearly distinct wording, not just a
   different prefix.
