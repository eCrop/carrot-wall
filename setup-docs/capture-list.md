# capture-list.md · Everything to record and screenshot

Running shot-list for the capture pass. Text content references these by ID. Status: ☐ to capture · ◐ partial · ☑ done.

## R1 · The wall build recording (the master footage)

One real build session of the Carrot Wall, recorders running throughout. This single session feeds the Day 1 cold open, all Day 2 snippets, and the Day 4 factory decode. Capture with asciinema (`--idle-time-limit 2`) for terminal work plus OBS or Screen Studio for full-screen moments. Terminal at 18 to 20pt, notifications off, 1080p.

Beats the footage must contain (build the session so these actually happen):

- ☐ R1.1 The prompt being typed, real time (the spec interview kickoff)
- ☐ R1.2 Plan mode entered, the plan appearing, a slow skim
- ☐ R1.3 The approval keystroke at the plan gate (hold on it)
- ☐ R1.4 Parallel work: two worktrees, two agents on separate FE surfaces — the wall view + submit flow (F1/F2) in one, TV mode (F7) in the other — visible side by side at least once. Real spec features, not staged.
- ☐ R1.5 The integrator agent merging the two streams
- ☐ R1.6 One wobble: a failing test, then the fix (leave it in)
- ☐ R1.7 The review running automatically after execute finishes
- ☐ R1.8 `ship` producing the stack of PRs with descriptions and commits
- ☐ R1.9 Tests green, real time
- ☐ R1.10 The live product: the wall loading, a post submitted from a phone
- ☐ R1.11 A real-elapsed-time reference (clock or timestamps) for the honesty overlay

Edits to cut from R1 later (edit pass, not capture): the 3:00 cold open (cut sheet in the playbook), the Day 2 slowed plan-gate moment, the Tier 1 style quick-edit snippet, the execute montage, the ship moment, the 60 second labeled factory replay for Day 4.

## R2 · BizPliz product capture

- ☐ R2.1 About 20 seconds of bizpliz.pt live: landing, one real user flow clicked through, on a clean browser profile. No client data on screen beyond the public site.

## S1 · Day 1 tour screenshots or live checkpoints

The tour is live, but each stop needs a fallback screenshot for the backup deck, sanitized (abstract every name except BizPliz):

- ☐ S1.1 `tree .claude/` of the base template (the map)
- ☐ S1.2 The CLAUDE.md file open, the @AGENTS.md import visible
- ☐ S1.3 A bare `pip install` bouncing off the PreToolUse hook in the terminal
- ☐ S1.4 The three subagent files with their model lines visible (code-reviewer on opus, the haiku pair)
- ☐ S1.5 The skill listing showing the loop four plus ponytail-review
- ☐ S1.6 `/context` output on a session with a few MCP servers connected (also reused Day 3)

## S2 · Day 3 material

- ☐ S2.1 `/doctor` or `/context` showing heavy MCP tool usage before Tool Search, and the same view after (the before and after pair)
- ☐ S2.2 The memory directory: MEMORY.md open next to a topic file with its frontmatter
- ☐ S2.3 A Figma MCP capability screenshot or short clip for the shown-only slide (verify source and rights, or describe on a plain slide instead)

## S3 · Day 4 material

- ☐ S3.1 Two terminals, two worktrees, both mid-run (can be pulled from R1.4 as a still)
- ☐ S3.2 `/advisor opus` in action from Pedro's Team account: the Advising and Reviewed lines in a transcript
- ☐ S3.3 `/cost` output after an opusplan session

## S4 · Carrot Wall app screenshots (after the build)

For guides and slides: ☐ S4.1 the wall view with posts · ☐ S4.2 the submit form at phone width · ☐ S4.3 TV mode with the QR · ☐ S4.4 the admin view.

## L1 · Logos and brand assets (status: have)

- ☑ eCrop mark (uploaded, transparent) · ☑ Carrot logo (uploaded, background removed) · ☑ NobleProg wordmark (uploaded, background removed)
- ☐ L1.1 Claude Code and Anthropic marks for slides: check Anthropic brand usage guidance before placing any logo; plain text "Claude Code" is always safe.

## Live on the day (no capture needed, bookmark instead)

Docs pages shown live: code.claude.com best practices (the sizing quote), model-config (opusplan), the advisor page, the memory page, the plugins page. Keep a bookmarks folder named per day, plus offline PDF prints of each as the fallback.
