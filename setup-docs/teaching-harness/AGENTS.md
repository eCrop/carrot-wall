# AGENTS.md

A twenty-line stand-in for a five-hundred-line file. The real one carries one
org's product names, CI, package scopes and house conventions, so it is not in
this subset. What is kept is the one section the loop skills actually read.

**Why this file is the point.** Open `.claude/skills/spec/SKILL.md`. It contains
no paths, no commands, no layer names — deliberately. Every noun it needs, it
looks up here at runtime. So the skill never changes when the stack changes;
this file does. That split is the lesson. Copy the split, not the values.

## Stack profile for the loop

| Field | Value |
| --- | --- |
| Spec dir | `docs/specs/<slug>/` |
| Spec template | `docs/specs/TEMPLATE-spec.md` |
| Spec style guide | `docs/specs/STYLE.md` |
| Gate script | `./scripts/loop-gate.sh <stage> <file>` |
| Apps | `apps/api` · `apps/web` |

Each app carries its own `apps/<app>/AGENTS.md` with the same section heading,
adding the fields the root cannot know:

| Field | `apps/api` | `apps/web` |
| --- | --- | --- |
| Layer order | route → service → repository → model | page → gateway → action → component |
| Full gate | `make test` | `pnpm gate` |

## Writing your own

Keep the headings, replace every value. For Carrot Wall the Apps row is
`apps/api` · `apps/web` again, but Layer order becomes something like
`resource → service → repository → entity` and the Full gate is `./mvnw test`
and `npm test`.

One rule worth keeping: if a skill asks for a field that is not in here, that is
a blocker. Add the field. Never let the agent guess it — a plausible invented
path costs more later than an open question costs now.
