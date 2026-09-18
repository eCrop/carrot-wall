# Intent: deciding what the room looks at

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F4 · **Depends on:** 03

## Problem

By Wednesday the wall is long, and the post worth discussing right now is somewhere in the
middle of it. There is also the other case, rarer and more urgent: something goes up that
should not be on a projector in front of the client's whole engineering team, and the
instructor needs it gone in one click, in front of everyone, without apologising to a
database.

## Proposed outcome

Two controls on each card in the admin view. Pin lifts a post to the top of the wall and of
TV mode and keeps it there until it is unpinned; several pinned posts stay in their own
newest-first order. Hide removes a post from every public view immediately — the wall, TV
mode, the API — while leaving the row untouched in the database, so nothing is ever actually
destroyed and a mistaken hide is one click back.

It satisfies spec §7.3 and §7.4.

## Affected users and systems

The instructor acts; the room sees the result within a poll cycle. New: admin endpoints for
pin/unpin and hide/unhide, and the controls on the admin card. The ordering rule already
exists from slice 01, so this slice mostly proves it was built right. No schema change.

## Constraints

- Hidden is a soft delete and only a soft delete. No endpoint in this project deletes a post.
- A hidden post must be absent from the public response, not merely styled away — if it is in
  the JSON, the slice is not done.
- The admin view still shows hidden posts, marked as hidden, or they cannot be brought back.
- Pinning must not rewrite the post's timestamp; unpinning returns it to where it belongs.
- Tests ship with the slice: hidden absent from the public read but present in the row count,
  pinned ordering ahead of newer unpinned posts.

## Open questions

- Should hiding a post also strip it from a client that already has it on screen mid-cycle, or
  is "gone within five seconds" good enough for a room?
- Is there a case for a pin limit, so the top of the wall does not become the whole wall?
