# Intent: letting the instructor in

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F8 (the gate) · **Depends on:** 01

## Problem

Everything the instructor does to the wall — answering, pinning, hiding, changing the prompt —
is destructive if anyone in the room can do it. Three separate slices are waiting on a way to
tell "this is Pedro" from "this is an attendee with the URL", and none of them should invent
their own.

## Proposed outcome

A passcode screen at `/admin`. Type the PIN, and the browser holds a session that unlocks the
admin view of the wall for the rest of the day. Every admin API route refuses anyone without
it, plainly and immediately, rather than quietly doing nothing. No PIN, no admin page: not a
hidden one, not a read-only one.

This slice ships the lock and nothing behind it — the admin wall shows the same posts as `/`
with room for the controls that arrive in slices 04 to 07. It satisfies spec §7.8.

## Affected users and systems

The instructor, on a laptop, on conference wifi. New: the gate itself, the session cookie,
and whatever marks a route as admin-only. Also new: admin responses that include hidden posts,
which is the one place hidden content is allowed to leave the server.

## Constraints

- The PIN comes from the `ADMIN_PIN` environment variable and is never committed. The dev
  default stays obviously a default.
- Wrong PIN gets a 401, and so does a missing session on any admin route — including the ones
  that do not exist yet. The rule is set here once, not per endpoint.
- One instructor, one laptop, five days. No accounts, no roles, no password reset.
- The session survives a page refresh; it does not need to survive a redeploy.
- Tests ship with the slice: a request without the session is refused, a request with it is not.

## Open questions

- Cookie session or a token the client resends? A cookie is fewer moving parts and refresh
  survives for free.
- Does the PIN need any brute-force protection, or is a five-day room of colleagues below the
  threshold where that is worth the code?
- On the projector the admin session must never be the one showing — is that a discipline
  thing, or should `/tv` actively ignore admin sessions?
