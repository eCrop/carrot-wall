#!/usr/bin/env bash
set -euo pipefail
mkdir -p .claude/commands .claude/agents .claude/skills/project-conventions

# --- commands: the loop ---
cat > .claude/commands/spec.md <<'EOF'
---
description: Interview me, then write a one-page spec to docs/specs/
argument-hint: [feature in one or two sentences]
---
I want to build this on the Carrot Wall: $ARGUMENTS

Before writing any code, interview me one question at a time about anything unclear:
scope, edge cases, what done means. When you have enough, write a spec to
docs/specs/<feature-name>.md with: Problem, In scope / Out of scope,
Acceptance criteria I can check, Constraints. One page. No code yet.
EOF

cat > .claude/commands/plan.md <<'EOF'
---
description: Propose an implementation plan from a spec, without writing code
argument-hint: [path to the spec, or the feature in one sentence]
---
Read $ARGUMENTS. Propose an implementation plan with: the files you will change and
why, the order of work, risks or open questions, and how we will verify it works
(which tests, which manual check). Do not write code yet.
EOF

cat > .claude/commands/migration.md <<'EOF'
---
description: Create a new Flyway migration following this project's conventions
argument-hint: [what the schema change does]
---
Create a new Flyway migration for: $ARGUMENTS
Follow the existing files under apps/api/src/main/resources/db/migration/ for naming
and style. Never modify an existing migration. Include the entity change, then run
./mvnw test.
EOF

# --- subagents: model tiering, visible on screen ---
cat > .claude/agents/code-reviewer.md <<'EOF'
---
name: code-reviewer
description: Reviews changes for correctness, security and convention adherence. Use after implementing a feature.
model: opus
---
Review the current diff. Check: correctness against the spec, input validation on any
new endpoint, no secrets or personal data in logs, tests cover the acceptance criteria,
and adherence to the conventions in CLAUDE.md. Report findings by severity. Do not fix
anything yourself; report only.
EOF

cat > .claude/agents/test-runner.md <<'EOF'
---
name: test-runner
description: Runs the test suites and reports failures. Use when verification is needed.
model: haiku
---
Run ./mvnw test in apps/api and npm test in apps/web. Report which tests failed and the
first meaningful error line for each. Do not fix anything.
EOF

# --- skill ---
cat > .claude/skills/project-conventions/SKILL.md <<'EOF'
---
name: project-conventions
description: How code is written in the Carrot Wall project. Use when creating or modifying source files, tests, or migrations.
---
# Conventions

## Structure
- apps/web: Angular standalone components, Material themed to the Claude tokens.
- apps/api: Quarkus REST resources with Bean Validation, Panache entities.

## Rules
- Never modify an existing Flyway migration. New schema changes get a new versioned file.
- Messages render as text, never innerHTML.
- Every new endpoint validates its input with Bean Validation annotations.

## Tests
- API: JUnit next to the resource. Web: unit tests beside the component, e2e in apps/web/e2e.
- A change is not done until ./mvnw test and npm test both pass.
EOF

# --- hooks ---
# Hooks receive the tool call as JSON on stdin; file_path lives under .tool_input.
cat > .claude/settings.json <<'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "f=$(python3 -c 'import json,sys;print(json.load(sys.stdin).get(\"tool_input\",{}).get(\"file_path\",\"\"))'); case \"$f\" in *.ts|*.html|*.scss|*.json) (cd apps/web && npx prettier --write \"$f\") >/dev/null 2>&1 || true;; esac" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "f=$(python3 -c 'import json,sys;print(json.load(sys.stdin).get(\"tool_input\",{}).get(\"file_path\",\"\"))'); case \"$f\" in */db/migration/V*) if [ -e \"$f\" ]; then echo 'Existing migrations are immutable. Create a new versioned file instead.' >&2; exit 2; fi;; esac" }
        ]
      }
    ]
  }
}
EOF

echo "Harness created. Test the migration guard once before demoing: ask Claude to edit V1__posts.sql."
