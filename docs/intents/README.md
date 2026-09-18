# docs/intents

The Carrot Wall spec (`/spec.md`) cut into eight slices, each small enough to build and
demo on its own, ordered so that every slice only depends on the ones before it.

An intent is a proto-spec: what is wanted, why, for whom, under which constraints — in
plain words, before any design or code. Each file here becomes a `/spec` run, then a plan,
then a branch. See https://academy.claude.com/courses/ai-native-sdlc-playbook/capture-intent

| # | Intent | Covers | Depends on |
|---|--------|--------|-----------|
| 01 | [Wall view](01-wall-view.md) | F1 | — |
| 02 | [Submit a post](02-submit-a-post.md) | F2 | 01 |
| 03 | [Admin passcode gate](03-admin-passcode-gate.md) | F8 | 01 |
| 04 | [Instructor answers](04-instructor-answers.md) | F3 | 03 |
| 05 | [Pin and hide](05-pin-and-hide.md) | F4 | 03 |
| 06 | [Upvotes](06-upvotes.md) | F5 | 01 |
| 07 | [Prompt of the moment](07-prompt-of-the-moment.md) | F6 | 03 |
| 08 | [TV mode](08-tv-mode.md) | F7 | 01 |

01+02 and 08 are the two independent surfaces the setup guide earmarks for parallel
worktrees; they share only the data model.
