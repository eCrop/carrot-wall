# Intent: answering out loud

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F3 · **Depends on:** 03

## Problem

People post questions all week. Answering them verbally works for whoever is in the room at
that moment and is lost by the afternoon, and a question with no visible answer reads as a
question nobody cared about. The wall needs to show that someone replied.

## Proposed outcome

From the admin view, the instructor writes one answer under any post, and can rewrite it
later when the real answer turns out to be better. The answer shows up on everyone's wall
within a poll cycle, in a tinted block under the original message, labelled eCrop and stamped
with when it was written. The card picks up a quiet ✓ so it is obvious at a glance which
questions have been dealt with.

It satisfies spec §7.5.

## Affected users and systems

The instructor writes; the whole room reads. New: an admin endpoint to set or replace a post's
answer, the inline editor on the admin wall, and the answer block on the public card. The
columns already exist from migration V2 — no schema change.

## Constraints

- One answer per post, editable, never a thread. If it needs a conversation, that happens out
  loud in the room.
- Answers render as text, like messages. Same escaping rule, no exceptions for the admin.
- Writing an answer must not reorder the wall — an answered post stays where it was.
- Clearing an answer is a legitimate action; the card then loses its ✓.
- Tests ship with the slice: setting, replacing, and the answer appearing in the public read.

## Open questions

- Should answering also pin, since an answered question is often the one worth reading aloud?
  Probably not automatically, but they do get used together.
- Is 1000 characters enough for an answer, or does a link-heavy reply need more?
- Does the timestamp show absolute time or relative, given the cards already use relative?
