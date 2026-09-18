# Guide 3 · Superpowers

**Day 3 · The Carrot Wall project · roughly 2 hours, at your pace**

Yesterday you ran the same prompts by hand. Today they get names. By the end of this guide your harness will have its own slash commands, one skill, one hook, one connected MCP server, and the beginning of a memory that outlives any single session. Everything here is generic on purpose: take it, make it yours, delete what you do not need.

The order matters a little. Commands first, because you already understand them. Hooks last, because they are the only part that can bite.

---

## Before you start

- Your fork is up to date, your work from yesterday is pushed, and both apps run.
- You have yesterday's spec or plan prompt handy (Guide 2). You are about to give it a name.
- Run `/context` once and note the number. You will compare later.

## Step 1 · Turn a prompt into a command

A slash command is a Markdown file in `.claude/commands/`. Its content is the prompt. Its filename is the name. That is the whole mechanism.

Create `.claude/commands/spec.md`:

```markdown
---
description: Interview me, then write a one-page spec to docs/specs/
argument-hint: [feature in one or two sentences]
---
I want to build this on the current project: $ARGUMENTS

Before writing any code, interview me one question at a time about anything unclear:
scope, edge cases, what done means. When you have enough, write a spec to
docs/specs/<feature-name>.md with these sections: Problem · In scope / Out of scope ·
Acceptance criteria I can check · Constraints. One page. No code yet.
```

Create `.claude/commands/plan.md`:

```markdown
---
description: Propose an implementation plan from a spec, without writing code
argument-hint: [path to the spec, or the feature in one sentence]
---
Read $ARGUMENTS. Propose an implementation plan with: the files you will change and
why, the order of work, risks or open questions, and how we will verify it works
(which tests, which manual check). Do not write code yet.
```

Start a new session and run `/spec` with a feature from `feature-ideas.md`. Same prompt as yesterday, one word to type. Commit the two files. Your harness has begun.

Optional third: `.claude/commands/execute.md` with your Step 4 prompt from Guide 2. Notice that `/plan` works best inside plan mode (Shift+Tab): the command supplies the prompt, the mode supplies the safety.

## Step 2 · Add one skill

A skill is knowledge Claude pulls in when it is relevant, instead of you pasting it every time. It lives in `.claude/skills/<name>/SKILL.md`. Only the name and description are loaded at startup; the body arrives when the task matches. That is why the description matters more than anything else in the file.

A generic template, useful on almost any codebase:

```markdown
---
name: project-conventions
description: How code is written in this project. Use when creating or modifying source files, tests, or migrations.
---
# Conventions for this project

## Structure
- <where things live: modules, layers, folders>

## Naming and style
- <the two or three rules people actually get wrong here>

## Tests
- <where tests live, how they are named, what must be covered before a change is done>

## Do not
- <the one or two things that have caused pain before>
```

Fill it from what you learned in two days on the Carrot Wall. Keep it short; a skill that reads like a book does not get read. Then test the trigger: start a fresh session and ask for a small change to a source file without mentioning the skill. Check with `/context` whether it loaded. If it did not, sharpen the description. A skill that never activates is just a file.

## Step 3 · Connect one MCP server, with the context check

MCP servers give Claude tools: a browser, your issue tracker, your design files. They also cost context, because every tool definition takes space in the window. So we connect one, and we measure.

Pick one:

**Playwright**, the natural choice today. It lets Claude drive a real browser against the running Carrot Wall:

```
claude mcp add playwright -- npx @playwright/mcp@latest
```

**Context7**, if you would rather fight API hallucinations: it feeds Claude current library docs on demand. **Your issue tracker**, if you want the spec-to-tickets flow: most trackers ship an MCP server now; use yours.

After adding it, run `/mcp` to confirm it is connected, then `/context` again and compare with the number from before you started. That difference is the price of the tools. Claude Code loads tool definitions on demand once they grow past a share of the window, but the discipline is still yours: connect what you use, audit with `/context`, remove what sits idle.

Now use it. With Playwright connected:

```
Open http://localhost:4200 in the browser, submit a post through the form, and confirm it
appears on the wall. Then write an end-to-end test for that flow under apps/web/e2e/.
```

Watch it click through your own feature from yesterday. That is the moment the server earns its context.

## Step 4 · Automate something recurring

The Wall's schema lives in Flyway migrations. Adding one is exactly the kind of recurring, rule-bound task worth automating. Create `.claude/commands/migration.md`:

```markdown
---
description: Create a new Flyway migration following this project's conventions
argument-hint: [what the schema change does]
---
Create a new Flyway migration for: $ARGUMENTS
Follow the existing files under apps/api/src/main/resources/db/migration/ for naming
and style. Never modify an existing migration; always add a new versioned file.
Include the corresponding entity or model change, then run ./mvnw test.
```

Run it for a small change (a new column, an index). One prompt, one convention, enforced every time by the command text. This is a recipe, not a hook: it guides, it does not block. Which brings us to the part that does.

## Step 5 · Add one hook

Hooks run shell commands at specific moments. Unlike anything in CLAUDE.md or a skill, they are deterministic: they happen whether or not Claude agrees. Use them for the few rules that must never be broken.

Create or edit `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cd apps/web && npx prettier --write \"$CLAUDE_FILE_PATHS\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

That formats every file Claude edits in the web app. Boring, deterministic, gone from your review comments forever.

A second, sharper example, for the rule from yesterday. A `PreToolUse` hook can block an edit by exiting with code 2; whatever it prints to stderr goes back to Claude as the reason:

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "case \"$CLAUDE_FILE_PATHS\" in *src/test/*|*.spec.ts) echo 'Test files are protected during fixes. Fix the code, not the test.' >&2; exit 2;; esac"
    }
  ]
}
```

Add it under `"PreToolUse"` when you are working on a bug fix, remove it when you legitimately need to write tests. Test the hook by asking Claude to edit a test file and watching it bounce. Then check the exact hook event names and the settings format against the live docs; hooks are the one part of this guide where a typo silently does nothing.

## Step 6 · Start your memory

Three moves, in increasing depth:

1. In any session, start a line with `#` to add a memory without opening a file. Use it the moment Claude gets something wrong that it should never get wrong again.
2. Run `/memory` and look at what is already there. Claude keeps its own notes between sessions in a memory directory, with an index file and topic files. You are allowed to read them, prune them, and correct them.
3. Write one lesson from today into CLAUDE.md by hand. Yesterday's line, today's line. That is how it compounds.

## If you get stuck

A command not showing up: check the filename and that it is under `.claude/commands/`. A skill not triggering: rewrite the description as a sentence about when to use it. A hook doing nothing: `/doctor`, then the docs. An MCP server failing to connect: `/mcp` shows the error; most often the package name or a missing login.

## Take it home

Tonight: one command and one hook in one of your real repos. The command you already have. The hook: start with formatting, it is the one nobody argues with. Between now and Monday, run your commands on real tickets and notice which prompt you keep wanting to change. That is your next command.

## Stretch, if you finished early

- Bundle your `.claude/` into a plugin so a colleague can install it in one line (the plugins page in the docs shows the manifest).
- Ask Claude to review your `MEMORY.md` for duplicates and contradictions, and to propose a cleaned version. You have just done by hand what Anthropic's memory consolidation is being built to do automatically.
- Install one plugin from the list we shared this morning, and read its SKILL.md before you trust it. Plugins are code.
