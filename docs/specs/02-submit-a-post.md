# Spec: submit a post (`/post`)

**Author:** Pedro Fonseca · **Date:** 2026-09-19 · **Status:** draft
**From intent:** `docs/intents/02-submit-a-post.md` · **Covers:** spec F2

## Problem

The wall reads beautifully and nobody can write to it. Attendees need to post from their
phones in under twenty seconds, mid-session, without an account, an email, or a download —
the moment it takes longer than a sticky note, they stop using it.

## In scope

**Create API**
- `POST /api/posts` — body: `message` (required), `name` (optional), `type` (required, one of
  `quero-aprender` | `pergunta` | `frustração` | `livre`).
- Server trims `message` and `name`, then validates: message 1–280 chars after trim (blank or
  whitespace-only rejected), name ≤40 chars. Blank/omitted name is stored as absent — "Anónimo"
  is a display fallback, never a stored value.
- Returns the created post (including its `id`) on success, so the client can highlight it.
- Rate limit: 5 posts/minute, keyed on a client token (see below), not IP — the room shares
  one public IP behind Railway, and IP-keying would lock out the whole class together. Over
  the limit → HTTP 429 with a PT message.
- Client token: a random UUID the browser generates once and keeps in `localStorage`, sent as
  an `X-Client-Token` header on every `POST /api/posts`. Requests with no token get their own
  bucket (effectively unlimited) rather than a 400 — this is a friendly-room guard, not auth.
- No schema change: the `posts` table already has every column this needs.

**Web `/post` route**
- Reachable with one tap from `/` (a button/FAB).
- One phone screen: message textarea with a live character counter (280 max), optional name
  input (placeholder "Anónimo"), four type chips, submit button.
- Type chips default to `livre` selected; tapping another chip changes the selection (single-select).
- Inputs ≥16px font so iOS does not zoom on focus.
- Client-side check mirrors the server (non-empty trimmed message, ≤280/≤40 chars) purely as a
  courtesy — disabling submit / showing inline PT copy — but the server is the source of truth.
- On success: navigate to `/?highlight=<newPostId>`. The wall reads that id, rings the matching
  card in coral for 2s (CSS transition, no animation library), then drops the param from the
  URL (`location.replaceState` or `Router.navigate` with `replaceUrl`) so a refresh doesn't
  re-trigger it.
- On validation error (empty message, over length): inline PT error, nothing submitted, no
  navigation.
- On rate limit (429): inline PT error asking the person to wait a bit — no stack trace, no
  English.
- All copy is Portuguese, warm, human: e.g. "Escreve à vontade — respondemos durante a semana."

**Tests**
- JUnit: successful creation persists a trimmed post with the right defaults; message length
  boundaries (0, 1, 280, 281 chars, whitespace-only) accepted/rejected correctly; the 6th
  request within a minute from the same token is rejected with 429, the 5th is not.
- Angular: character counter updates live and blocks over 280; empty submit shows the PT error
  and fires no HTTP call; type chip selection changes on tap with `livre` pre-selected.
- Playwright e2e (`apps/web/e2e/`): fill the form, submit, land on `/` with the new post visible
  and its card carrying the highlight ring.

## Out of scope

- Editing or deleting a submitted post.
- Accounts, email, any identity beyond the optional free-text name.
- Persisting the client token across browsers/devices, or using it for anything but rate
  limiting (it is not an upvote guard — that is F5's own token, defined separately).
- Changing the rate limit behavior in production vs dev — it is enforced the same everywhere,
  because it is teaching material, not a production safety valve.
- Any change to `/`'s polling or merge logic beyond consuming the new `highlight` query param.

## Acceptance criteria

1. Submitting a valid message (any type, name optional) creates a post and lands back on `/`
   with that post visible.
2. The just-submitted post's card is ringed in coral for ~2s, then the ring disappears.
3. Submitting an empty or whitespace-only message shows a PT validation error and creates no
   row — verified against the DB, not just the UI (spec §7.1).
4. A message of exactly 280 chars (after trim) is accepted; 281 is rejected, client- and
   server-side.
5. A blank name stores no name; the wall (and this form's own success state) shows "Anónimo",
   never a literal empty string or "null".
6. A 6th `POST /api/posts` within 60 seconds from the same `X-Client-Token` is rejected with
   429 and a PT message; the first 5 succeed. A different token is unaffected by another
   token's count.
7. `/post` is fully usable at 360px width with no horizontal scroll; message input renders at
   ≥16px.
8. A message containing `<script>alert(1)</script>` is stored and later rendered on `/` as
   literal text, never executed (spec §7.12 — shared with the wall-view slice's own test, but
   the write path is this slice's to prove).
9. `./mvnw test` and `npm test` (including the new Playwright spec) pass from a fresh clone.

## Constraints

- Validation lives on the server; the browser check is a courtesy only.
- Message 1–280 chars after trim; name optional, ≤40 chars after trim; blank name is not
  stored as a made-up value.
- Inputs ≥16px to avoid iOS zoom-on-focus.
- All user-facing copy is Portuguese, warm, written like a person, never a raw validation
  message.
- Rate limiting is real code with a real test (Day 3 teaching material), keyed on a
  browser-generated `X-Client-Token` header, not IP.
- No `[innerHTML]` anywhere; Angular interpolation only.
- No new Flyway migration — V1–V3 already cover the columns this needs.
- Design tokens and PT tone per spec §4, inherited from the wall-view slice's theme setup.
