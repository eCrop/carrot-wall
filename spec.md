# spec.md — Carrot Wall (Claude Code Masterclass companion app)

> **Meta note (why this file looks the way it does):** this spec is itself a course artifact. It follows the sized-loop shape taught on Day 2 — problem, scope, out of scope, checkable acceptance criteria, constraints — and it will be shown to the room alongside its `plan.md`. Build it through the full loop on purpose: spec → plan mode (opusplan) → human gate → execute → verify → small PRs. Keep the artifacts committed.

## 1. Problem / why

During the five-day masterclass we need a live, low-friction channel where attendees post what they want to learn, questions, and frustrations — from their phones, in seconds, no accounts — and the instructor answers, pins, and reads the wall back to the room. It replaces paper stickies, doubles as the week's parking lot and daily pulse, and is itself a proof point: a small production-quality app built agentically in an evening.

**Users & contexts:**
- **Attendee** — phone (360px+) or laptop; posts in under 20 seconds; Portuguese UI.
- **Instructor (admin)** — laptop; answers, pins, hides, changes the active prompt; enters via passcode.
- **The room (projector)** — a TV mode readable from 6 meters, always showing the submit QR.

## 2. In scope (features)

### F1 — Wall view `/`
- Responsive card grid (masonry-ish or simple columns), **newest first**, **pinned posts always on top** with a subtle 📌 marker.
- Each card shows: type chip, message, author name (or "Anónimo"), relative time, upvote count, and — when present — the instructor's answer in a visually distinct block beneath the message.
- **Auto-refresh via polling every 5 s** (no reload, no websockets). New posts animate in gently (fade/slide, 200 ms).
- **Prompt banner** pinned above the grid showing the currently active prompt (see F6).
- Empty state: friendly line + QR ("Sê o primeiro a escrever na parede.").
- **Seed data on first boot:** at least 10 posts spanning all four types (including at least one pinned and one already answered), and **at least 3 Flyway migrations** telling a real schema story (not one migration dumping the whole schema at once) — both exist specifically so Day 1's codebase-Q&A exercise ("explain the migrations," "what's the ugliest part of this codebase") has real material to work with.

### F2 — Submit `/post` (also reachable from a button on `/`)
- Fields: **message** (required, 1–280 chars, live counter), **name** (optional, placeholder "Anónimo", ≤40 chars), **type** (single-select chips):
  - 💡 `quero-aprender` — "Quero aprender"
  - ❓ `pergunta` — "Pergunta"
  - 😤 `frustração` — "Frustração"
  - 💬 `livre` — "Livre"
- Submit → redirect to `/` with the new post briefly highlighted (coral ring, 2 s).
- No accounts, no email. **Rate limit: 5 posts / minute / IP** with a polite error.
- Mobile-first: the whole form fits one phone screen; inputs ≥16px font (no iOS zoom).

### F3 — Instructor answers
- Admin can write **one answer per post** (editable). Answer renders under the message in a tinted block with a small "eCrop" label and timestamp.
- Answered posts get a subtle ✓ on the card.

### F4 — Pin / hide (moderation)
- Admin can **pin/unpin** (pinned float to top, keep recency order among themselves) and **hide** (soft delete: removed from all public responses, never hard-deleted).

### F5 — Upvotes
- Any visitor can **+1 a post once** (guard via localStorage token; good enough for a friendly room). Count shown on card. No downvotes.

### F6 — Prompt of the moment (admin)
- Admin sets the active prompt from **presets** or free text. Presets shipped:
  1. Arrival (Day 1): "A única coisa que quero desta semana é…"
  2. Minute cards (daily close): "Uma coisa que aprendi hoje · uma coisa que ficou confusa"
  3. Pulse: "Como correu o dia? O que ajustamos amanhã?"
  4. Parking lot: "Perguntas para o fim do dia"
  5. Gap week (Day 3 close through Day 4): "Perguntas da semana"
- Changing the prompt updates the banner on all clients within one poll cycle.

### F7 — TV mode `/tv`
- Read-only projector view: the prompt as a large heading, latest + pinned posts in **big type** (message ≥ 32px rendered), auto-cycling through recent posts every 8 s while also live-updating, and a **persistent QR code** (bottom-right, ≥180px) linking to `/post`.
- No admin controls, no hover states, dark-mode variant optional (see Design).

### F8 — Admin `/admin`
- Single **passcode** gate (env `ADMIN_PIN`); session cookie after entry; all admin API routes reject without it (401).
- Admin sees the wall with inline controls: answer, pin, hide, prompt selector. Nothing fancier.

## 3. Out of scope (v1)
- Accounts, OAuth, email, notifications.
- Threads/comments beyond the single instructor answer.
- Websockets/SSE (polling is fine for ~15 clients).
- Analytics, i18n beyond PT, file/image uploads, emoji reactions beyond +1, editing/deleting own posts.
- Google Forms integration — the native form replaces it (same simplicity, better wall).

## 4. Design (Claude / Anthropic-inspired)

**Source of truth:** run `npx getdesign@latest add claude` and keep the generated `DESIGN.md` in the repo root; instruct the agent to follow it for all UI work. Direction in three words: **warm, editorial, calm**.

Core tokens (inline so the build never blocks on the download; must match DESIGN.md where they differ, DESIGN.md wins):
- **Background** ivory `#FAF9F5` · **surface/tint** `#F0EEE6` · **ink** `#141413` · **muted** `#6B6A63` · **hairline** `#E2DFD6` · **accent (terracotta/coral)** `#D97757` · TV dark variant: bg `#141413`, text `#FAF9F5`.
- **Type:** serif display for the prompt banner and headings (e.g. `Lora` or `Source Serif 4` via Google Fonts — Tiempos-adjacent), clean sans for everything else (`Inter`). Generous line-height (1.5+), no ALL-CAPS body.
- **Shape & texture:** cards on tint with 12px radius and **hairline borders — no drop shadows**; whitespace does the structure; one accent color used sparingly (chips, pins, highlights, answer label). Buttons: ink fill / ivory text, coral only for the primary submit.
- **Motion:** subtle only — 150–250 ms fades/slides; nothing bouncy.
- **Tone of microcopy:** PT, warm and human ("Escreve à vontade — respondemos durante a semana."), never corporate.

## 5. Data model

```
Post    { id, name?, message, type: 'quero-aprender'|'pergunta'|'frustração'|'livre',
          pinned: bool, hidden: bool, upvotes: int,
          answer?: { text, updatedAt }, createdAt }
Prompt  { id, text, activatedAt }   // exactly one active (latest)
```

## 6. Tech constraints
- **Stack mirrors the audience's:** monorepo with `apps/web` — **Angular 17+ (standalone components) + Angular Material**, themed to the tokens above — and `apps/api` — **Java 21 + Quarkus** (REST resources, Bean Validation). This is deliberate: attendees train on the code shapes they work in daily.
- **Zero-config local run:** `./mvnw quarkus:dev` (API, port 8080) + `npm start` (web, port 4200, proxy to API). **H2 file-based database** with **Flyway migrations** (the schema ships as versioned migrations — the most common Java setup, and deliberately practicable for the Day-3 automation exercises), auto-created with **seeded demo posts** — no Docker, no external DB, nothing to provision. `.env.example` / `application.properties` documented; the only secret is `ADMIN_PIN`.
- Polling endpoints return JSON; all responses exclude hidden posts unless the admin session is present.
- **Messages render as text, never HTML** (Angular's default interpolation escaping — keep it; no `innerHTML`).
- Fonts via Google Fonts (serif display + Inter); Material theme customized to the palette, density comfortable.
- Repo hygiene (course-grade): `CLAUDE.md` with build/test/lint commands for BOTH apps, this `spec.md` + the approved `plan.md` committed at repo root, small PRs.
- **Two published variants:** the full build (Pedro's, with harness — demo material) and the **public stripped repo** (same code, no `.claude/` directory) that attendees clone, branch on (branch-per-person, pushed for review), and re-harness themselves during the week.
- **A real starter test suite ships with v1, not just manual verification.** At minimum: a handful of passing JUnit tests on the API (covering the post-creation and rate-limit logic) and a handful of passing Angular unit tests plus one Playwright or Cypress end-to-end test on the web app (covering the submit-and-see-it-appear flow, in `apps/web/e2e/`). `./mvnw test` and `npm test` must mean something real on day one — Guide 1's starter CLAUDE.md hands attendees these exact commands, Guide 2's verification step and the recorded "wobble" (a failing test, then the fix) both depend on real tests existing, and Guide 3's Playwright exercise extends a real `e2e/` convention rather than inventing one.
- **`feature-ideas.md` ships at the repo root**, committed alongside `spec.md` and `plan.md` — it is the Day-2 and Day-3 challenge backlog and is referenced by name in both guides.
- **A `docs/specs/` folder exists from the first commit** (even if only a `.gitkeep` or a short README), establishing the convention attendees' own `/spec` prompts and commands write into from Day 2 onward.

## 7. Acceptance criteria (checkable)
1. Submitting an empty message shows a validation error and stores nothing.
2. A valid post appears on `/` on other clients within ≤5 s without a page reload.
3. Pinned posts always render before all unpinned posts.
4. Hidden posts appear in **no** public API response or view; they remain in the DB.
5. An instructor answer appears under the post on all clients within ≤5 s and the card shows ✓.
6. A visitor can upvote a given post exactly once per browser; the count updates without reload.
7. Changing the active prompt updates the banner on `/` and `/tv` within one poll cycle.
8. All `/admin` pages and admin API routes return 401 without the correct PIN.
9. The 6th post from one IP within a minute is rejected with a readable PT error.
10. `/post` is fully usable at 360 px width; message input is ≥16 px font.
11. `/tv` shows the QR at all times and message text renders ≥32 px.
12. A message containing `<script>alert(1)</script>` renders as literal text everywhere.
13. The wall stays usable with 200 posts (pagination or capped render — pick one, state it in plan.md).
14. A fresh clone boots with exactly two commands (`./mvnw quarkus:dev` and `npm start`) and one env var (`ADMIN_PIN`); seeded demo posts are visible on first load.
15. `./mvnw test` and `npm test` each run a real, passing suite (not zero tests) straight after a fresh clone, with no setup beyond what criterion 14 already requires.

## 8. Stretch (only if v1 lands early)
- Filter chips on the wall by type · CSV export of posts (admin) · confetti (tasteful) when a post gets 5+ upvotes · gentle dark-mode auto-switch for `/tv`.

## 9. Note for the build recording (Day 1 cold open / Day 4 factory decode)
The two natural independent surfaces for a parallel-worktree demo are **the wall view + submit flow (F1/F2)** and **TV mode (F7)**, or alternatively **the wall view** and **the admin panel (F3/F4/F8)** — both are genuinely independent front-end surfaces that share only the data model, which is exactly what makes a clean parallel-agents-then-integrate story true rather than staged. Avoid inventing a "board" surface that is not in this spec; use the real feature split so the recording never has to fudge what actually happened.

## 10. Sizing note (for the Day-2 exhibit)
By the routing questions this is a **Tier 2–3 borderline** app (multi-surface, but small and low-risk). It is deliberately run through the **full Tier-3 loop** anyway — spec → opusplan plan → human gate → build → verify — because its artifacts are teaching props: "the wall you posted on this morning went through the loop you're learning right now."
