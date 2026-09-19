---
description: Remove a slice's git worktree, kill its dev servers/containers, free its ports — only after its PR is open
argument-hint: [worktree path or branch name]
---
Clean up the worktree for: $ARGUMENTS

This is a hard constraint, not a suggestion: **do not remove anything until you've confirmed
a PR is open for the branch.** Check with `gh pr view <branch> --json url,state` (or
`gh pr list --head <branch>`). If no PR exists, stop and say so — do not clean up "just this
once" because the work looks finished.

Once a PR is confirmed:

1. **Kill dev servers.** Free this project's dev ports if anything is still bound to them:
   `lsof -ti tcp:8080 -ti tcp:4200 | xargs -r kill -9`, then verify with `lsof -i tcp:8080 -i
   tcp:4200` — it should print nothing.
2. **Stop containers.** `docker ps -a --filter "name=<slug>"` for anything named after the
   branch or worktree; stop and remove any match. Leave unrelated containers alone.
3. **Verify the worktree is clean.** `git -C <path> status --short` — if it prints anything,
   stop and tell the user rather than discarding it. Never pass `--force` to work around this
   unless the user explicitly says to discard those changes.
4. **Remove the worktree**, from the main checkout, not from inside it:
   `git worktree remove <path>`.
5. **Never delete the branch**, local or remote — the open PR still points at it.

Report what you killed/removed and confirm the ports are free.
