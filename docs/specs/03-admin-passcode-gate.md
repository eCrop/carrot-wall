# Spec: admin passcode gate (`/admin`)

**Author:** Pedro Fonseca · **Date:** 2026-09-19 · **Status:** implemented
**From intent:** `docs/intents/03-admin-passcode-gate.md` · **Covers:** spec F8

## Problem

Everything the instructor will do from `/admin` in slices 04–07 (answer, pin, hide, change the
prompt) is destructive if anyone in the room can reach it. This slice builds the one gate all
of those slices sit behind, plus the shell that shows the wall to whoever gets through it —
nothing else.

## In scope

**Login**
- `POST /api/admin/login` — body `{ pin }`. Correct PIN (`wall.admin-pin`, from `ADMIN_PIN`,
  dev default `0000`): sets a session cookie (`HttpOnly`, `SameSite=Lax`, no `Max-Age` — a
  browser-session cookie, so it survives a refresh but not necessarily a closed browser) and
  returns 200. Wrong PIN: 401, no cookie set, no hint about why it's wrong.
- `GET /api/admin/session` — 200 if the request carries a valid session cookie, 401 otherwise.
  Used on `/admin` load to decide gate-vs-wall without resubmitting the PIN.
- The session is an opaque server-side check (e.g. a signed/random token compared against
  what login issued) — no accounts, no roles, no password reset, no logout button, no
  expiry beyond the browser session ending.

**The 401 rule, set once**
- A single shared mechanism (filter/interceptor) marks routes as admin-only and rejects any
  request without a valid session cookie with 401 — including admin routes that don't exist
  yet (slices 04–07's answer/pin/hide/prompt endpoints). Those slices register on this
  mechanism; they do not each reimplement the check.
- `POST /api/admin/login` itself is public (that's the whole point); `GET /api/admin/session`
  is public too (it's how the client asks "am I logged in", not a privileged read).

**Hidden posts on the wall read**
- `GET /api/wall` (and its `before=`/`since=` variants, from slice 01) gains an optional
  `?includeHidden=true` param. It only has effect when the request also carries a valid admin
  session; otherwise it's silently ignored and the response is the ordinary public shape.
  `GET /api/wall` stays an unauthenticated route — attendees poll it every 5s — so a missing
  session with the flag present does not 401, it just returns the public payload.

**Web `/admin` route**
- On load, calls `GET /api/admin/session`. Valid session → renders the wall (same component/
  layout as `/`, reused, calling `GET /api/wall?includeHidden=true`, so hidden posts are
  visible with no visual distinction beyond what a later slice adds). No valid session →
  renders a passcode screen instead: one PIN input + submit, nothing else.
- Passcode screen submits to `POST /api/admin/login`. Success → re-render as the admin wall
  (no full page reload needed, but a reload is also fine). Wrong PIN → inline PT error next
  to the input, field stays editable, no navigation.
- No controls beyond viewing: no answer/pin/hide/prompt UI. Those arrive in slices 04–07 and
  build on this route.
- `SpaRoutes.java` already reroutes `/admin` to `index.html` on refresh (per root `CLAUDE.md`).

**Tests**
- JUnit: `POST /api/admin/login` with the right PIN sets a cookie and returns 200; wrong PIN
  returns 401 with no cookie; `GET /api/admin/session` returns 200 with a valid cookie and 401
  with none/an invalid one; a placeholder admin-only route (or the session-check route's
  sibling used to prove the shared filter) rejects a request with no cookie at 401; `GET
  /api/wall?includeHidden=true` returns hidden posts with a valid session and the public-only
  shape without one.
- Angular: passcode form renders and submits; wrong PIN shows the inline PT error and does not
  navigate; a valid session shows the wall instead of the form on load.

## Out of scope

- Anything the instructor *does* from `/admin` beyond viewing: answering, pinning, hiding,
  changing the prompt (slices 04–07 each build their own admin-only endpoint against the
  shared 401 mechanism this slice establishes).
- Logout, session expiry, "remember me" beyond the browser-session cookie, multiple
  instructors, roles, password reset, brute-force protection on login attempts.
- Any visual distinction for hidden posts on the admin wall (e.g. a badge or dimmed card) —
  that's for whichever slice adds the hide control.
- `/tv`'s own behavior: it always calls `GET /api/wall` (never with `includeHidden`), so it
  never sees hidden posts regardless of what cookie happens to be in its browser — this is
  existing-by-construction from slice 01's contract, not new code this slice adds. If a future
  slice's TV work changes that contract, it re-verifies this guarantee then.
- Rate limiting the login endpoint.

## Acceptance criteria

1. Visiting `/admin` with no session shows the passcode screen, not the wall, not a 404.
2. Submitting the wrong PIN shows a PT inline error, sets no cookie, and does not reveal the
   wall.
3. Submitting the correct PIN (`ADMIN_PIN`, dev default `0000`) shows the wall and refreshing
   the page keeps showing the wall (no re-prompt) without resubmitting the PIN.
4. A request to `GET /api/admin/session` with no cookie returns 401; with the cookie from a
   successful login, 200.
5. Any admin-only API route — present or future — returns 401 for a request without a valid
   session cookie, via the one shared check, not a per-endpoint copy (spot-checked with at
   least one such route in this slice's tests).
6. `GET /api/wall?includeHidden=true` returns hidden posts when called with a valid admin
   session cookie, and the ordinary public payload (no hidden posts, no error) when called
   with none.
7. A post with `hidden = true`, visited on `/admin`, appears on the admin wall; the same post
   never appears on `/` or on a plain `GET /api/wall` call.
8. `/admin` is usable at 360px width; the PIN input is ≥16px font.
9. `./mvnw test` and `npm test` pass from a fresh clone, including new tests for this slice.

## Constraints

- PIN comes from `ADMIN_PIN` (property `wall.admin-pin`), dev default `0000`, never committed
  as a real value.
- Session cookie is `HttpOnly` (never read from client JS) and has no explicit `Max-Age` — it
  is a browser-session cookie, matching "survives refresh, does not need to survive a
  redeploy."
- No brute-force protection on `/api/admin/login` — out of scope by decision, revisit only if
  the room's threat model changes.
- `GET /api/wall` remains callable without any session; `includeHidden` is additive and never
  breaks the existing public contract from slice 01.
- No `[innerHTML]` anywhere; Angular interpolation only, per root `CLAUDE.md`.
- No new Flyway migration — this slice adds no columns.
