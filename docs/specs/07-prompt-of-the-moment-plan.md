# 07 — Prompt of the moment — plan

## Files

**New migration**
- `apps/api/src/main/resources/db/migration/V6__prompt_presets.sql` — new `prompt_presets`
  table (`id BIGSERIAL PRIMARY KEY`, `text VARCHAR(200) NOT NULL`), seeded with the 5 texts from
  spec §7.7. Separate table from `prompts`, per the spec decision: presets are reference data,
  never activated rows themselves, so activating one still goes through the same
  insert-or-bump-timestamp path as free text.

**API**
- `PromptPreset.java` — new Panache entity, `PanacheEntityBase` + `IDENTITY` id, matching
  `Prompt`'s shape. `listAll()` ordered by `id`.
- `PromptPresetDto.java` — `record(Long id, String text)`.
- `Prompt.java` — add `activate(String text)`: find a row with that exact `text`; if found, set
  its `activatedAt = now()` (needs a `@PreUpdate`-driven or explicit touch — simplest is setting
  the field directly since there's no other mutable column to protect); if not found, persist a
  new `Prompt`. This is the one write path for this slice, replacing any bulk-update temptation.
- `ActivatePromptRequest.java` — `record(Long presetId, String text)`. Exactly one of the two is
  expected; `presetId` wins if both are somehow sent.
- `AdminResource.java` — two additions under `@AdminOnly`:
  - `GET /api/admin/prompts/presets` → `List<PromptPresetDto>`.
  - `POST /api/admin/prompt` → resolves `presetId` to preset text (404 if unknown id) or uses
    trimmed `text`; rejects blank/empty or >200 chars with 400 + `ApiError`, same shape as the
    existing answer-length check; otherwise calls `Prompt.activate(...)` and returns 204.
- No change needed to `WallResource`/`WallResponse`/`PromptDto` — already reads `Prompt.active()`.

**Web**
- `wall.models.ts` — no change (`Prompt` shape is unchanged).
- `admin/prompt-selector.ts` / `.html` / `.scss` / `.spec.ts` — new standalone component: 5
  preset buttons (fetched once from the new presets endpoint) + a free-text input with its own
  submit button. Highlights whichever preset's text matches the currently active prompt (passed
  in as an `input()`), does nothing for free text. On submit, calls the service and shows a PT
  error inline on failure, mirroring `AnswerEditorComponent`'s pattern already in this repo.
- `admin/admin-prompt.service.ts` — new service: `getPresets()` (GET) and
  `activate({ presetId } | { text })` (POST), same try/catch-to-PT-error shape as
  `AdminPostsService.setAnswer`.
- `wall/wall.html` — inside the existing `<header class="wall-prompt">`, add
  `@if (admin()) { <app-prompt-selector [activeText]="p?.text ?? null" /> }` next to the prompt
  text, so it only renders on the admin wall (`AdminComponent` already passes `[admin]="true"`).
- `wall/wall.ts` — import `PromptSelectorComponent` into `WallComponent`'s `imports`.

**Tests**
- `PromptTest.java` (new, mirrors `PostTest.java`) — `activate()` inserts a new row for unseen
  text; `activate()` on already-used text bumps `activatedAt` on the same row (same `id`) without
  creating a duplicate; `Prompt.active()` still returns the most recently activated row after
  each case.
- `AdminResourceTest.java` — add cases: presets endpoint 401s unauthenticated, returns the 5
  seeded rows authenticated; activating a preset changes what `GET /api/wall` returns; activating
  the same text twice does not duplicate rows (query count via a direct repository check or via
  re-activating and asserting `GET /api/wall`'s prompt `id` is unchanged); blank/too-long text is
  rejected with 400 and leaves the active prompt untouched; missing session cookie on
  `POST /api/admin/prompt` is rejected with 401; a `<script>` payload round-trips as literal text
  through `GET /api/wall`.
- `prompt-selector.spec.ts` (new) — renders 5 presets, marks the one matching `activeText` as
  selected, calls the service on click/submit, shows the PT error on a rejected promise.
- No new Playwright e2e per spec (out of scope beyond what's listed); the JUnit + Angular unit
  tests satisfy spec acceptance criterion 9.

## Order of work

1. Migration `V6` (presets table + seed) — everything else depends on this data existing.
2. `PromptPreset` entity + DTO, `Prompt.activate()`, `PromptTest.java` — smallest testable unit,
   no HTTP yet.
3. `ActivatePromptRequest` + the two `AdminResource` endpoints, extend `AdminResourceTest.java` —
   verifies the full write path including 401/400 behavior.
4. Run `./mvnw test` — API slice complete and green before touching Angular.
5. `admin-prompt.service.ts` + `prompt-selector.ts/html/scss` + spec — component in isolation.
6. Wire into `wall.html`/`wall.ts` behind `admin()`.
7. `npm test` — Angular slice green.
8. Manual check (below), then PR.

## Risks / open questions

- **`activate()`'s timestamp bump isn't covered by `@PreUpdate`** the way `Post.touch()` is,
  because `Prompt` has no other field that changes on a normal update — setting `activatedAt`
  directly inside `activate()` is simplest and matches the spec's "insert or a timestamp change"
  wording literally; flagging this as a deliberate difference from `Post`'s pattern, not an
  oversight, so it doesn't get "fixed" into a spurious `@PreUpdate` later.
- **Case/whitespace on free text vs. a preset's stored text**: if the admin types a preset's
  text with different whitespace or casing, this plan treats it as a *new* row (exact match
  only), same as any other free text. Cheap to change to a trimmed/normalized comparison later
  if it turns out to matter; not adding that now since the spec doesn't ask for it.
- **Concurrent activation** (two admin tabs racing) isn't guarded beyond normal row semantics —
  fine for a single instructor in one browser, per the course's actual usage.
- Confirm the preset seed texts are copied verbatim from spec §7.7 into the migration (five
  exact PT strings) — a transcription slip would only surface as "the preset button doesn't say
  what the guide says," easy to miss in review.

## Verification

- **Automated**: `cd apps/api && ./mvnw test` (new `PromptTest`, extended `AdminResourceTest`);
  `cd apps/web && npm test` (new `prompt-selector.spec.ts`).
- **Manual**: run both dev servers, open `/admin`, log in, click each of the 5 presets and
  confirm the banner text changes; type free text and submit, confirm it activates; open `/` in
  a second tab and confirm the banner updates there within 5 s without a reload; submit a
  `<script>alert(1)</script>` prompt and confirm it renders as literal text on both `/` and
  `/admin`; log out (clear the session cookie) and confirm `POST /api/admin/prompt` via curl
  returns 401.
