# Intent: writing to the wall

**Author:** Pedro Fonseca · **Date:** 2026-09-18 · **Status:** draft
**Covers:** spec F2 · **Depends on:** 01

## Problem

The wall reads beautifully and nobody can write to it. Attendees need to post from their
phones in under twenty seconds, mid-session, without an account, an email, or a download —
the moment it takes longer than a sticky note, they stop using it.

## Proposed outcome

A form at `/post`, reachable with one tap from the wall, that fits on one phone screen: a
message box with a live character count, an optional name, and four chips to say what kind
of post this is — quero aprender, pergunta, frustração, livre. Send it and you land back on
the wall with your own post briefly ringed in coral so you can see it arrived. An empty
message is refused before anything is stored. Someone hammering the form is slowed down
politely, in Portuguese, not with a stack trace.

It satisfies spec §7.1, §7.9, §7.10 and §7.12.

## Affected users and systems

Attendees, on phones, in the two minutes before a session starts. New: a create endpoint
with server-side validation, the rate limiter behind it, and the `/post` route. No schema
change — the posts table already has every column this needs.

## Constraints

- Validation lives on the server as well as in the form. The browser check is a courtesy.
- Message 1–280 characters, name optional and at most 40. Blank name means "Anónimo"; it is
  not stored as a made-up value.
- Inputs at 16px or larger, or iOS zooms the page on focus and the form stops fitting.
- Everything the user reads is Portuguese, warm, and written by a person: "Escreve à vontade
  — respondemos durante a semana", not "Validation failed".
- The rate limit is real code with a real test, because it is teaching material on Day 3.
- Tests ship with the slice: creation, the 280-character boundary, and the rate limit.

## Open questions

- The spec says five posts per minute per IP. The whole office comes through one public IP,
  so the sixth post from the room gets refused on Monday morning — the arrival wall dies in
  the first five minutes. Raise the limit, key it on a browser token instead of an IP, or
  leave it off in production and keep the code for the lesson? This needs deciding inside
  this slice, not after.
- Behind Railway the caller's address is in `X-Forwarded-For`; if the limit stays IP-keyed,
  that is the value to read.
- Should the type chips have a default selection, or force a deliberate choice?
