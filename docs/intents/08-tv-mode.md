# Intent: the wall on the projector

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F7 · **Depends on:** 01

## Problem

The wall is designed for a phone in your hand, and for most of the week it will be on a
screen at the front of a room, read by people six metres away during the breaks. At that
distance the cards are illegible, the controls are noise, and — the thing that actually
matters — there is nothing on screen telling a new arrival how to post.

## Proposed outcome

A read-only view at `/tv` built for a projector: the active prompt as a large heading, recent
and pinned posts in type big enough to read from the back of the room, cycling gently through
them every few seconds so the screen is never static and never stale, and a QR code parked in
the corner that is always there, large enough to scan from a seat, pointing straight at the
submit form. It updates itself like the wall does. Nothing on it can be clicked, because
nobody is standing at the projector.

It satisfies spec §7.11, and §7.7 once the prompt becomes changeable in slice 07.

## Affected users and systems

The room, passively, all week. New: the `/tv` route, its cycling behaviour, and the QR code.
It reads the same endpoint the wall already uses — no new API, no schema change. This is why
it can be built alongside slices 01 and 02 rather than after them. The instructor is affected
indirectly: this is the screen behind them while they talk, so anything distracting on it
costs attention they need.

## Constraints

- Message text renders at 32px or larger. If it does not, the view has failed its only job.
- The QR is on screen permanently, at least 180px, and links to the submit form rather than
  to the wall — someone scanning it wants to write, not read.
- No admin controls, no hover states, no interactivity at all.
- Cycling must not hide new posts: a post arriving mid-cycle still gets its turn.
- Dark variant is optional and only if it costs nothing, since the room lights are usually down.
- Tests ship with the slice, including the one end-to-end check the course needs: post from
  the form, see it appear (spec §7.15).

## Open questions

- Cycle through recent posts a screenful at a time, or scroll continuously? Paging is calmer
  and easier to read; scrolling never has an awkward half-empty page.
- Do pinned posts stay on screen through every cycle, or take their turn like the rest?
- Eight seconds per page is the spec's guess. Worth checking against a real paragraph-length
  post read aloud at projector distance.
