---
name: spec
description: First stage of the spec -> plan -> execute -> ship loop. Turns a problem statement or a ticket id into a reviewable spec.md that states intent only, records every unknown as an open question, and stops at Status draft for a human to approve.
---

> **Workshop copy.** This skill holds zero stack facts on purpose — it looks every
> one of them up at runtime from the Stack profile section of the root
> `AGENTS.md`, and a stub of that file sits at the root of this folder so you can
> see the mechanism. `docs/specs/TEMPLATE-spec.md`, `docs/specs/STYLE.md` and
> `scripts/loop-gate.sh` live in the source repo and are not included; you will
> write your own. Read this one for the split: generic procedure here, every
> noun over there.

# Spec

This skill body holds zero stack-specific facts. Every command, path, layer name
and tool name you need is looked up at runtime from the **Stack profile for the
loop** section of the root `AGENTS.md` for the fields shared by the whole
monorepo, and of `apps/<app>/AGENTS.md` for the fields that belong to one app.
If a field you need is missing there, that is a blocker, not an excuse to guess.

Input: a problem statement, or a ticket id you can read. Output: one `spec.md`
left at `Status: draft`.

## Steps

1. **Read the stack profile.** Decide which of `apps/api` and `apps/web` the
   problem touches — that decision is the spec's Apps line. Every later stage
   re-derives the set from the code it actually finds and must agree with it, so
   a wrong Apps line surfaces as a contradiction rather than silently steering
   the run. Read the "Stack profile for the loop" section of the root
   `AGENTS.md` for Spec dir and Gate script, then the same section of
   `apps/<app>/AGENTS.md` for each app you named, for Layer order. Every later
   step uses them.

2. **Scope the codebase, read-only.** Read and search until you can describe what
   already exists in the area the problem touches: current behaviour, the
   patterns already used, the constraints already enforced. Change nothing —
   no writes, no formatters, no commands that mutate state.

   Where the change spans both apps, that includes the boundary: verify in
   `apps/api` every contract `apps/web` intends to consume — endpoint shapes,
   error and message codes, expand allowlists, field names. Both apps live in
   this repo and both are writable, so anything missing is a requirement of this
   spec like any other; a missing endpoint is work, not a blocker. Never write a
   frontend workaround for it, because the workaround outlives the gap.

3. **Create the spec file.** Pick a kebab-case slug that names the change, not
   the solution. Create the Spec dir for that slug. Copy `docs/specs/TEMPLATE-spec.md` into
   it as `spec.md`, then fill every section. Obey `docs/specs/STYLE.md`; if a
   template section does not apply, say so in one line rather than deleting it.
4. **Write intent only.** A requirement says what must be true when the work is
   done. It never says how.

   | Belongs in the spec | Belongs in the plan stage |
   | --- | --- |
   | Observable behaviour | Architecture and layering |
   | Inputs, outputs, states | File and module names |
   | Rules, limits, permissions | Library and pattern choices |
   | Unhappy paths | Task breakdown and ordering |
   | Non-goals | Test file layout |

   If you catch yourself naming a file, you have drifted. Move the thought into
   the notes you hand the plan stage and delete it from the spec.
5. **Record every unknown.** Any question you cannot answer from the repository
   becomes a bullet under Open questions, written as
   `[NEEDS CLARIFICATION: <question>]`. Ask about the specific fact you need, not
   for permission. Guessing is forbidden — a plausible invented answer costs more
   later than an open marker costs now. The gate script fails while any marker
   remains, which is the point.

   Most apparent unknowns are lookups, not questions. The
   `clarify-before-assume` skill is the table of which file in this repo answers
   which kind of gap — message codes, expand relations, i18n keys, gateway
   namespaces. Work through it before writing a marker; a marker for something
   the repo already states costs a human round trip for nothing.
6. **Leave the status alone.** The file ends at `Status: draft`. You never
   approve your own spec.
7. **Print the grill checklist.** It is the last thing you output, in full, every
   run. Do not summarise it and do not answer it yourself.

## Grill checklist

A human reads these out loud and answers each one before touching the Status
line. Any "no" sends the spec back to the "Write intent only" step.

1. Could someone who never saw this conversation build the right thing from this
   file alone?
2. Is every requirement observable, and by what observation? Name the check for
   each one.
3. Are the non-goals written down, including the tempting ones we are choosing
   not to do?
4. Has any design decision smuggled itself in as a requirement — a file, a
   library, a structure, an ordering?
5. Which requirement is the riskiest guess about what was actually wanted, and
   what happens if that guess is wrong?
6. Is anything in here that nobody asked for?
7. What happens on the unhappy paths — empty, denied, offline, concurrent,
   oversized, partially failed?
8. Is every `[NEEDS CLARIFICATION]` resolved into a requirement or a non-goal,
   with none left as prose?
9. Does the slug still describe this spec after the grilling, or did the scope
   move?

10. Does every contract `apps/web` consumes already exist in `apps/api`, or
    appear here as a requirement of its own rather than a workaround?

## Opening the gate

Only a human edits the Status line. When the checklist passes, that human sets
`Status: approved`, and this command must exit 0 before the plan stage starts:

```sh
./scripts/loop-gate.sh spec docs/specs/<slug>/spec.md
```

Exit 0 means the gate is open. Nobody re-implements this check.
