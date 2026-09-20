# The teaching harness

One worked example of each kind of thing we talk about this week. Not the whole
eCrop harness — you are not here to inherit ours, you are here to build yours.

## Why none of this is your stack

That is deliberate. These files come from a Python/FastAPI + Next.js monorepo.
If they were Quarkus and Angular you would paste them in and learn nothing.
Because they are not, you have to read them and work out what they do before you
can translate them — which is the entire exercise.

So read for the **shape**: the frontmatter fields on an agent, the path glob that
scopes a rule, the hook's contract of JSON in and a permission decision out, the
split between a skill body and the memory file it reads its nouns from. All of
that transfers. `pytest`, `pnpm gate` and `alembic` do not.

## What is here

| File | Kind | The part that transfers |
| --- | --- | --- |
| `.claude/agents/code-reviewer.md` | subagent · opus · effort high | frontmatter, confidence scoring, a fixed output contract |
| `.claude/agents/test-runner.md` | subagent · haiku | a cheap model on mechanical work, reporting only what matters |
| `.claude/hooks/block_destructive_bash.sh` | hook | stdin JSON in, permission decision out |
| `.claude/hooks/block_secrets_access.sh` | hook | same contract, different matcher |
| `.claude/hooks/*.test.sh` | hook tests | a hook you have not tested is a hook that silently does nothing |
| `.claude/rules/api/logging_and_tokens.md` | rule | a path glob scoping knowledge to the files it applies to |
| `.claude/skills/spec/SKILL.md` | skill | a procedure holding zero stack facts |
| `.claude/workflows/spec.js` | workflow | a deterministic spine, one model per phase |
| `AGENTS.md` | memory (stub) | where every fact the skill needs actually lives |
| `.claude/settings.json` | wiring | how hooks get registered |

## The two hooks are yours to keep

Everything else here is an exhibit. These two run unchanged on a Java repo:

```sh
bash .claude/hooks/block_destructive_bash.test.sh
bash .claude/hooks/block_secrets_access.test.sh
```

Both suites pass. Run them, then break a rule on purpose and watch a case fail.
That loop — write the hook, write the test, watch it fail for the right reason —
is the habit worth leaving with.

## What is deliberately missing

The real root `AGENTS.md` (five hundred-odd lines of one org's product, CI and
package names), the other twenty-four rule files, the other ten skills, the
second reviewer agent, and the spec template and gate script the skill points at.

You write those. Guide 3 walks you through your first one. Files here that name
something not in this folder are not broken exports — you are holding one file
out of a harness, and the rest is your week.
