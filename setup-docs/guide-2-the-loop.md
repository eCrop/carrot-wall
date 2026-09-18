# Guide 2 · The Loop

**Day 2 · The Carrot Wall project · roughly 2 hours, at your pace**

By the end of this guide you will have taken one feature from idea to working code through the full loop: spec, plan, execute, verify, commit. You will run each stage as a written prompt, by hand. That is on purpose. Tomorrow these exact prompts become your own slash commands, and a command you have run by hand is a command you understand.

One thing before anything: size the work. Not every task deserves the full loop. Anthropic's own docs put it in one sentence: if you could describe the diff in one sentence, skip the plan.

---

## Before you start

- You are on your branch from yesterday, and your CLAUDE.md is in the repo.
- Open `feature-ideas.md` in the repo root and pick a feature. Any one you like, or invent your own.
- Both apps run (`./mvnw quarkus:dev` and `npm start`).

## Step 1 · Size it

Ask these four questions about your feature, in order:

1. Could you describe the diff in one sentence? Then it is a **direct change**. Skip to Step 4 and just ask for it.
2. Does it cross the web app and the API, or touch the database schema? That is a **feature with touchpoints**. Run every step below.
3. Would someone else need context to review it cold? Also the full loop.
4. Otherwise it is a **small feature**: skip the spec, start at Step 3 with plan mode.

If in doubt: plan when the cost of a bad edit is higher than the cost of a slower first turn.

## Step 2 · The spec (touchpoint features only)

Start Claude Code at the repo root and run this prompt. Fill the bracket, keep the rest:

```
I want to build this feature on the Carrot Wall project: [your feature, one or two sentences].

Before writing any code, interview me. Ask me one question at a time about anything
unclear: scope, edge cases, what done means. When you have enough, write a spec to
docs/specs/[feature-name].md with exactly these sections:

- Problem: why this feature, one paragraph
- In scope / Out of scope: short lists
- Acceptance criteria: statements I can check, like "posting with an empty
  message shows an error and stores nothing"
- Constraints: anything that must not change

Keep it to one page. Do not write any code yet.
```

Answer its questions honestly. Push back when it assumes. When the file exists, read it like you would review a colleague's ticket: if an acceptance criterion is not checkable, fix it now. It is a text edit here and a rewrite later.

Commit the spec:

```
git add docs/specs/ && git commit -m "Spec: [feature-name]" && git push
```

A note on prototype-first work. If your feature is exploratory and you mostly want to see it before deciding, invert the order: ask for a quick rough version, play with it, and then write the spec from what you learned. A prototype that teaches you the spec is not skipping the process. It is the process for work you cannot describe yet.

## Step 3 · The plan

Enter plan mode with Shift+Tab. If you want the model split we showed this morning, run `/model opusplan` first: Opus thinks through the plan, Sonnet will do the building. Then:

```
Read docs/specs/[feature-name].md (or: here is what I want, if you skipped the spec).
Propose an implementation plan with:
- the files you will change and why each one
- the order of work
- risks or open questions
- how we will verify it works: which tests, which manual check

Do not write code yet.
```

Now read the plan properly. This is the human gate, and it is the highest-leverage two minutes of the whole loop. Check four things: the files it names are the right ones, the order makes sense, the risks are real, and the proof is concrete. Wrong direction caught here is a text edit. Caught after execution, it is an afternoon.

If something is off, say so and let it revise. When it is right, approve the plan. For touchpoint features, also save it: ask Claude to write the approved plan to `docs/specs/[feature-name]-plan.md` and commit it. A committed plan is something a colleague, or a colleague's agent, can pick up cold. That matters next week.

## Step 4 · Execute

Exit plan mode and run:

```
Implement the plan. Work through it in order. After each meaningful change, run the
relevant checks: API tests with ./mvnw test, web tests with npm test, and the build.
If a test fails, fix the code, not the test. Tell me when every check passes,
and show me the evidence, not just the claim.
```

While it works, watch. Interrupt with Esc the moment it drifts from the plan. Steering early is cheap.

For direct changes that skipped everything above, this is your whole loop: ask for the change and include the verification ask in the same prompt.

## Step 5 · Verify and commit

Do not take its word. Run the checks yourself once, click through the feature in the browser, and try to break it with the acceptance criteria from your spec. Then:

```
git add -A && git commit -m "[feature-name]: short description" && git push
```

Push to your fork, then open a pull request against the original repo and let Claude draft the description for you. That pull request is today's deliverable, and it is what I will read tonight.

## Step 6 · Write one thing down

Something surprised you today. A convention Claude missed, a command it needed, a wrong assumption it made twice. Put one line in CLAUDE.md before you stop. Start the line with # in the session to add it fast. This is how a harness grows: one scar at a time.

## If you get stuck

Post it on the wall or flag me down. The classic snags today: a plan that tries to change fifteen files for a small feature (your spec is too broad, shrink the scope) and tests failing for reasons unrelated to your change (tell Claude to investigate before touching anything).

## Take it home

Pick one real ticket from your actual backlog tomorrow. Size it with Step 1. Run only the loop it deserves. That is the entire assignment, and it is the whole point of today.

## Stretch, if you finished early

- Run a second feature at a different tier and feel the difference in overhead.
- For your touchpoint feature: ask Claude to write the failing test first, commit it, then implement until it passes without touching the test.
- Read the wall's own spec and plan in the repo root and compare them with yours. That pair was written the same way you just worked.
