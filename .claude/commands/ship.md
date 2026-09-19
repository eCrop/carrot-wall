---
description: Push the current worktree's branch, open a PR stacked on its predecessor (or main if merged), verify it, then hand off to /cleanup-worktree
argument-hint: [optional: base branch to use instead of auto-detecting]
disable-model-invocation: true
---
Ship the current worktree: $ARGUMENTS

This repo stacks slice branches on each other rather than always targeting `master` — see
the open PRs for the live example: PR #2 (`slice-02-submit`) targets `slice-01-wall-view`,
not `master`, because slice 01 wasn't merged yet. Reproduce that pattern here, then clean up
only once it's confirmed safe to.

## 1. Identify the branch, its worktree, and its predecessor

- `git branch --show-current` for the branch; `git worktree list` to confirm which path it's
  checked out in (run everything below from that path, not the main checkout).
- This branch's name should follow the `slice-<NN>-<slug>` convention. Its predecessor is
  `slice-<NN-1>-*` — find it with `git branch -a --list 'slice-*'`. If $ARGUMENTS names a base
  branch explicitly, use that instead of auto-detecting and skip straight to step 3.
- If there is no predecessor (this is slice 01, or the naming convention doesn't apply), the
  base is the repo's default branch: `gh repo view --json defaultBranchRef -q
  .defaultBranchRef.name` (don't hardcode `main`/`master`).

## 2. Decide the base: predecessor branch, or default branch

- Check whether the predecessor has already been merged:
  `gh pr view <predecessor> --json state,mergedAt` (or `git merge-base --is-ancestor
  <predecessor> origin/<default-branch>` if there's no PR to ask).
- **Merged → base is the default branch.** The predecessor's own branch may already be gone;
  targeting it would create a PR against a stale/deleted ref.
- **Open (or no PR yet) → base is the predecessor branch itself.** This is what keeps the
  diff reviewable — a PR against the default branch here would include every earlier slice's
  changes too, not just this one's.

## 3. Confirm there's something to ship

- `git status --short`. Anything uncommitted gets a real commit first — stage specific files
  (never `git add -A`), write a commit message that explains *why*, and follow this session's
  current attribution convention for the trailer. Do not invent a commit if the branch is
  already clean and already ahead of its base.
- If the branch has no commits ahead of the chosen base at all, stop and say so rather than
  opening an empty PR.

## 4. Push

- `git push -u origin <branch>` (or a plain `git push` if already tracking upstream).

## 5. Open the PR — skip if one already exists

- `gh pr list --head <branch> --json url,baseRefName` first. If a PR already exists:
  - targeting the right base already → reuse it, don't create a second one.
  - targeting the wrong base (e.g. the predecessor merged since it was opened) → note this
    to the user; retargeting an existing PR's base is `gh pr edit <n> --base <new-base>`, not
    a new PR.
- Otherwise `gh pr create --base <base> --title ... --body ...` with a title under ~70 chars
  and a body summarizing what changed and how it was verified, ending with this session's
  current PR-description attribution convention.

## 6. Verify

- `gh pr view <n> --json url,state,mergeable` and report the URL.
- `gh pr checks <n>` if the repo has any CI configured (`.github/workflows/`); if none exists,
  say so rather than pretending a check ran.
- This is the same gate `/cleanup-worktree` enforces on its own before touching anything: an
  **open PR must exist** for this branch. Confirm it does before moving to step 7 — if it
  doesn't (create failed, wrong repo, etc.), stop here and report why instead of cleaning up.

## 7. Hand off to cleanup

Once the PR is confirmed open, follow `.claude/commands/cleanup-worktree.md` for this exact
worktree/branch — kill dev servers, stop matching containers, confirm the worktree is clean,
remove the worktree, and never delete the branch. Don't duplicate that file's logic here;
read and follow it as-is so the two commands can't drift apart.

Report: the PR URL, its base, and what got cleaned up.
