# Intent: agreeing without typing

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F5 · **Depends on:** 01

## Problem

Three people write nearly the same question and the wall now has three cards saying one
thing, while the fifteen people who silently agree leave no trace at all. The instructor
cannot tell what the room actually wants to hear about, and attendees have no way to say
"that one, please" without adding noise.

## Proposed outcome

A +1 on every card. Tap it, the count goes up straight away, and that browser cannot do it
again on that post. The count is visible to everyone within a poll cycle, so by the coffee
break it is obvious which two questions the afternoon should start with.

It satisfies spec §7.6.

## Affected users and systems

Everyone in the room, from the wall and from TV mode's source data. New: an upvote endpoint
and the button on the card. The counter column already exists from migration V2.

## Constraints

- One vote per post per browser, remembered locally. This is a friendly room, not an election
  — a determined person with a private window can vote twice and that is an acceptable cost.
- No downvotes. The wall is a place to ask for things, not to score people.
- The count must not make the card jump or reorder the wall; votes do not change position.
- The button responds immediately rather than waiting for the next poll to reflect the tap.
- Tests ship with the slice: the increment, and the second vote from the same browser.

## Open questions

- Is the local guard per post or one record of everything voted? Per post is simpler to reason
  about and survives the list being pruned.
- Should a post crossing five upvotes do something visible, as the spec's stretch list
  suggests, or does that belong after v1 lands?
- On a shared projector, does the +1 belong in TV mode at all, or only as a displayed number?
