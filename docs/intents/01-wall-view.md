# Intent: the wall itself

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F1 · **Depends on:** nothing

## Problem

During the masterclass the room needs somewhere to see what everyone is thinking, without
anyone logging in or refreshing anything. Today that is paper stickies on a wall: they are
invisible from the third row, they do not update, and at the end of the day someone has to
type them up. The database already has seeded posts and a prompt; nothing shows them.

## Proposed outcome

Opening the app on a phone or a laptop shows the wall: the active prompt at the top, then
every visible post as a card with its type, message, author (or "Anónimo"), how long ago it
was written, its upvote count, and the instructor's answer underneath when there is one.
Pinned posts sit above everything else; below them, newest first. The page keeps itself
current by asking the API every five seconds, and new cards arrive with a soft fade rather
than a jump. If the wall is empty it says so warmly and points at the QR code.

This is what someone sees when they scan the QR on Monday morning, so it is the first thing
worth having. It satisfies spec §7.2, §7.3 and §7.13.

## Affected users and systems

Everyone in the room reads this view; nobody writes through it yet. New on the API side: a
read endpoint that returns visible posts and the active prompt. New on the web side: the `/`
route and its card component. The schema is already in place — no migration.

## Constraints

- Polling only, every five seconds. No websockets, no SSE — the room is about fifteen clients.
- Messages render as text, never as HTML. A post containing a `<script>` tag must read as a
  `<script>` tag (spec §7.12).
- Hidden posts must not appear in the response at all, not merely be filtered in the browser.
- Visual direction comes from spec §4: ivory ground, hairline borders, no drop shadows, one
  coral accent, serif for the prompt, Inter for everything else. This slice is where the
  Material theme gets set up, so later slices inherit it rather than re-deciding it.
- Readable at 360px. It is a phone app that also happens to work on a laptop.
- A fresh clone must boot with the two documented commands and show the seeded posts on first
  load — this is the slice where §7.14 becomes true or stops being true.
- Ships with its own tests: an API test for ordering and hidden-exclusion, a component test
  for rendering, both green from a fresh clone (spec §7.15).

## Open questions

- Two hundred posts by Friday is realistic. Paginate, or cap the render at the most recent
  N and let the rest fall off the bottom? The spec leaves the choice open and asks for it to
  be stated in the plan.
- Does the prompt banner need to animate when the prompt changes mid-session, or is a quiet
  swap on the next poll enough?
- Masonry or plain responsive columns? Masonry looks better with mixed message lengths and
  costs a dependency or a chunk of CSS.
