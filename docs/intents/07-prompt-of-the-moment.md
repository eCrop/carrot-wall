# Intent: asking the room a different question

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F6 · **Depends on:** 03

## Problem

The wall asks one question all week, and the week is not one question. Monday morning it
should ask what people want from the course; at the end of each day it should ask what landed
and what was confusing; on Thursday it is a parking lot for questions. Right now the prompt is
whatever was seeded into the database and changing it means a migration.

## Proposed outcome

The instructor picks the active prompt from the admin view — one of the five the course
already uses, or free text typed on the spot — and the banner changes on every screen in the
room within a poll cycle, wall and projector alike. Nobody reloads anything. The previous
prompts stay in the table, so the week leaves a record of what was asked when.

It satisfies spec §7.7.

## Affected users and systems

The instructor sets it; the room and the projector read it. New: an admin endpoint to activate
a prompt and the selector in the admin view. The prompts table and the first prompt already
exist from migration V3; the banner already reads the active one from slice 01.

## Constraints

- Exactly one prompt is active: the most recently activated row. Activating is an insert or a
  timestamp change, never an edit of an old row's text.
- The five course presets are offered as one-tap choices, not retyped from memory each day.
- The banner is the largest text on the wall and the first thing on the projector — the change
  has to be legible from six metres away, not just correct.
- Prompt text renders as text, same rule as everything else.
- Tests ship with the slice: activating changes what the public read returns.

## Open questions

- Do the presets live in the database as seeded rows or in the code as a list? Seeded rows are
  editable without a deploy; a code list cannot drift from the guides.
- When the prompt changes, should posts written under the previous one be marked somehow, or
  is the wall simply always about the current question?
- Is there any need to go back to a previous prompt as a first-class action, or is retyping it
  fine for a five-day course?
