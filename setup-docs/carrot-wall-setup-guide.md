# Carrot Wall setup guide (build, deploy, publish)

Everything needed to go from empty folder to a live wall with a public repo attendees can branch on. Written to be executed in one evening, in order.

---

## 0. The deployment decision, first

**Vercel cannot host this.** It runs JavaScript and Python serverless functions plus static frontends. There is no JVM runtime and no persistent disk, so both the Quarkus API and the H2 file are impossible there.

**Use Railway.** It is the closest thing to the Vercel experience for a Java stack: connect the GitHub repo, it builds your Dockerfile, you get an HTTPS URL, and a persistent volume is a click in the UI. Alternative if you prefer infra as code: Fly.io (`fly launch`, `fly volumes create`, `fly deploy`). Both cost a few euros a month.

The shape that makes this easy: **one container**. In production, Quarkus serves the built Angular files as static resources on the same port as the API. No CORS, no second service, no separate frontend host. Locally nothing changes: two terminals, two commands, exactly as the guides teach.

---

## 1. Before you start: three things to confirm now

1. **Which Angular version does Carrot use?** If they are on 17 or 18, pin the CLI (`npx @angular/cli@18 new ...`). If you scaffold today without pinning you get v22, which is zoneless by default with different file naming. Their three frontend devs will notice. One message to FG answers it.
2. ~~GitHub usernames~~ **Not needed.** Attendees fork the public repo and open pull requests, which requires no access to your repository and no invites. See section 8.
3. **Your Railway (or Fly) account exists** and is linked to GitHub.

Accounts and tools you need locally: Java 21, Node 20+, Maven (the wrapper comes with the scaffold), Docker (only for building the image locally if you want to test it), the Railway CLI (optional), and the GitHub CLI (`gh`) which makes the repo setup a two-minute job.

---

## 2. Scaffold the two apps

```bash
mkdir carrot-wall && cd carrot-wall
git init
```

**API** (Quarkus CLI, or generate the same thing on code.quarkus.io):

```bash
quarkus create app pt.ecrop:carrot-wall-api \
  --java=21 \
  -x rest-jackson,hibernate-orm-panache,hibernate-validator,jdbc-h2,flyway,smallrye-openapi \
  --no-code
mv carrot-wall-api apps/api
```

**Web** (drop `--standalone`, it is the default now and errors on current CLI):

```bash
ng new web --directory=apps/web --routing --style=scss --ssr=false
cd apps/web && ng add @angular/material && cd ../..
```

Then create the rest of the layout the course expects:

```bash
mkdir -p docs/specs
touch docs/specs/.gitkeep
# spec.md and feature-ideas.md: copy in the ones already written
```

Final shape:

```
apps/api/      Quarkus, port 8080
apps/web/      Angular + Material, port 4200
docs/specs/    where /spec writes from Day 2 onward
spec.md  plan.md  feature-ideas.md  CLAUDE.md  README.md
```

---

## 3. Configuration that will not fight itself

`apps/api/src/main/resources/application.properties`:

```properties
# --- Database: H2 file, PostgreSQL dialect so the SQL looks like work ---
quarkus.datasource.db-kind=h2
quarkus.datasource.jdbc.url=jdbc:h2:file:${WALL_DB_PATH:./data/carrot-wall};MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE

# --- Flyway owns the schema. Hibernate must not touch it. ---
quarkus.hibernate-orm.schema-management.strategy=none
quarkus.flyway.migrate-at-start=true

# --- Tests get a throwaway in-memory DB so they never collide with a running dev server ---
%test.quarkus.datasource.jdbc.url=jdbc:h2:mem:carrotwalltest;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE
%test.quarkus.flyway.migrate-at-start=true

# --- Admin ---
wall.admin-pin=${ADMIN_PIN:0000}

# --- Production: serve the built Angular app from this same service ---
%prod.quarkus.http.port=${PORT:8080}

# At work this would be PostgreSQL. Left visible on purpose, not wired for class:
# quarkus.datasource.db-kind=postgresql
# quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/wall
```

Two lines there matter more than they look. `schema-management.strategy=none` is the one that stops Hibernate and Flyway from fighting on first boot. The `%test` block is what stops ten people running `./mvnw test` next to a live `quarkus:dev` from corrupting each other's database on Monday morning.

Proxy for local dev, `apps/web/proxy.conf.json`:

```json
{ "/api": { "target": "http://localhost:8080", "secure": false } }
```

Wire it in `angular.json` under `serve.options.proxyConfig`, so `npm start` talks to the API with no CORS.

---

## 4. Migrations: three files, not one dump

`apps/api/src/main/resources/db/migration/`

- `V1__posts.sql` — the posts table, types, timestamps
- `V2__answers_and_moderation.sql` — answer columns, pinned, hidden, upvotes
- `V3__prompts_and_seed.sql` — the prompts table plus **at least 10 seeded posts** across all four types, one pinned, one answered

Three migrations telling a story is what makes Day 1's "explain the migrations in this repo" exercise real. One big dump teaches nothing. Keep the SQL portable: `BIGSERIAL`, `TEXT`, `TIMESTAMP` all work in H2's PostgreSQL mode; avoid `JSONB`, arrays, and other Postgres-only features.

---

## 5. Build the features (and record it)

Build in the order the recording needs, using your own loop so the artifacts are real:

1. Commit `spec.md` and the empty `docs/specs/` first.
2. Run `/spec` then `/plan`, approve the plan, commit `plan.md`. **These two files are Day 2's opening exhibit.**
3. Worktree A: **F1 wall view + F2 submit**. Worktree B: **F7 TV mode**. These are genuinely independent surfaces sharing only the data model, which is what makes the parallel story true rather than staged.
4. Integrate the two branches.
5. Then F3 to F6 and F8: answers, pin/hide, prompts, admin.
6. Tests throughout: JUnit on post creation and the rate limit, Angular unit tests, one **Playwright** e2e for submit-and-appear in `apps/web/e2e/`. Playwright specifically, because Guide 3 has attendees connect the Playwright MCP server and extend this same convention.

Recorders on for all of it, per the capture list. Terminal at 18 to 20pt, notifications off, clock visible.

---

## 6. The Dockerfile (one container, both apps)

Root `Dockerfile`:

```dockerfile
# 1. Build the Angular app
FROM node:20-alpine AS web
WORKDIR /web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build -- --configuration production

# 2. Build the Quarkus app, with the Angular output baked in as static resources
FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /api
COPY apps/api/ ./
COPY --from=web /web/dist/web/browser/ src/main/resources/META-INF/resources/
RUN mvn -B package -DskipTests

# 3. Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /deployments
COPY --from=api /api/target/quarkus-app/lib/ ./lib/
COPY --from=api /api/target/quarkus-app/*.jar ./
COPY --from=api /api/target/quarkus-app/app/ ./app/
COPY --from=api /api/target/quarkus-app/quarkus/ ./quarkus/
EXPOSE 8080
ENV WALL_DB_PATH=/data/carrot-wall
CMD ["java", "-jar", "quarkus-run.jar"]
```

Check the Angular output path (`dist/web/browser` on recent versions) after your first `npm run build`, and adjust the COPY if it differs.

Anything Quarkus finds in `META-INF/resources` is served statically, so the Angular app and the API end up on one port. Add a fallback route for deep links (`/tv`, `/admin`) so a refresh does not 404: a tiny `@Route`-level handler or the `quarkus-vertx-http` static resource config that forwards unknown paths to `index.html`.

---

## 7. Deploy to Railway

1. Push the repo to GitHub (next section) or use `railway init` locally.
2. On railway.app: **New Project → Deploy from GitHub repo**, pick the wall repo. It detects the Dockerfile and builds.
3. **Variables:** add `ADMIN_PIN`.
4. **Volume:** add one, mount path `/data`. Without this, every redeploy wipes the posts.
5. **Networking → Generate Domain.** You get an HTTPS URL. That URL is what goes in the QR code.

CLI equivalent:

```bash
railway init
railway up
railway variables set ADMIN_PIN=xxxx
railway domain
```

Fly.io alternative: `fly launch` (detects the Dockerfile), `fly volumes create carrot_wall_data --size 1`, mount it at `/data` in `fly.toml`, `fly secrets set ADMIN_PIN=xxxx`, `fly deploy`.

Deploy once as soon as the app boots at all, even before the features are done. A broken deploy discovered on Sunday night is a bad evening; discovered Monday at 09:00 it is the session.

---

## 8. The public repo attendees branch from

Two variants, one codebase:

- **Your instance** (private or public, your choice): the full build including `.claude/`. This is what you demo and what runs the live wall.
- **The public repo**: same `apps/web` and `apps/api`, **no `.claude/` directory**. This is what they clone and re-harness themselves.

```bash
# in your full build
gh repo create ecrop/carrot-wall --public --source=. --push

# strip the harness for the public variant
git rm -r --cached .claude
echo ".claude/" >> .gitignore
git commit -m "Public variant: build your own harness"
git push
```

**Protect main.** In Settings → Rules → Rulesets, target `main` and enable *Restrict deletions*, *Block force pushes*, and *Require a pull request before merging*. Belt and braces: with the fork model below, nobody has write access anyway.

**Attendees fork, they do not get access.** This is the standard open-source contribution model and it is the right one here:

1. They click **Fork** on your repo. They now own a full copy under their own account.
2. They clone their fork, branch, commit, push. All of that happens on *their* repository.
3. They open a **pull request** against `ecrop/carrot-wall`. Opening a PR requires no permissions on your repo at all.
4. You review every submission in one place: your Pull requests tab, with diffs, inline comments and review threads. You never have to merge any of them.

Why this beats adding collaborators: no invites to chase before Monday, no usernames needed in advance, nobody can push anything into your repository, and your nightly review is one browser tab instead of ten branch names. It also mirrors how they would contribute to any external project, which is a small free lesson.

Two settings worth checking once: under Actions → General, set *Fork pull request workflows from outside collaborators* to **Require approval for all outside collaborators**, so ten forks do not fire your CI unattended. And leave *Allow edits by maintainers* at its default, so you can push a fix into someone's PR branch while helping them.

If someone would rather not have a public fork on their profile, the fallback is **Use this template** (Settings → check *Template repository*), which gives them a clean unlinked copy. They then share a link with you directly. Slightly worse for you, since it is outside the PR queue, so offer it only if asked.

Finally, put `feature-ideas.md`, `spec.md`, `plan.md` and a short `README.md` at the root. The README should contain exactly the two commands and nothing clever.

---

## 9. The harness script (your demo variant)

Save as `scripts/setup-harness.sh` in your full build, run once. This creates the `.claude/` you show during the Day 1 tour, sized for the wall.

```bash
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
cat > .claude/settings.json <<'EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "cd apps/web && npx prettier --write \"$CLAUDE_FILE_PATHS\" 2>/dev/null || true" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "case \"$CLAUDE_FILE_PATHS\" in *db/migration/V*) echo 'Existing migrations are immutable. Create a new versioned file instead.' >&2; exit 2;; esac" }
        ]
      }
    ]
  }
}
EOF

echo "Harness created. Check hook event names against the current docs before demoing."
```

Run it, then **test the migration-guard hook live once** before Monday: ask Claude to edit `V1__posts.sql` and watch it bounce. That is your Day 1 tour stop 2, and it is a better demo than the pip example because it is about this repo.

---

## 10. QR codes

You need two: the wall URL for the holding slide and TV mode, and the repo URL for the challenge briefing.

Quickest local route:

```bash
# PNG files for the slides
npx qrcode "https://carrot-wall.up.railway.app" -o carrot-wall-qr.png -w 1000
npx qrcode "https://github.com/ecrop/carrot-wall" -o repo-qr.png -w 1000
```

In-app (TV mode needs one permanently on screen): `npm i angularx-qrcode` and drop `<qrcode [qrdata]="wallUrl" [width]="220"></qrcode>` into the TV component. The spec already requires this, so it is a feature, not a chore.

Send me the two URLs once they exist and I will generate the PNGs in the Claude palette for the deck.

---

## 11. Things that will bite you (checklist)

- [ ] **Rate limiting will lock the room.** The spec says 5 posts per minute per IP. Every attendee in Carrot's office shares one public IP, so the sixth post from the whole room gets rejected. Fix before Monday: raise the limit a lot (50/min), key it on a browser token instead of IP, or disable it in `%prod`. Keep the code and the test, because it is good teaching material; just do not let it block the arrival wall.
- [ ] **Behind Railway or Fly, the client IP is in `X-Forwarded-For`**, not the socket address. If you keep IP-based limiting, read the header, and enable `quarkus.http.proxy.proxy-address-forwarding=true`.
- [ ] **Deep links must not 404.** `/tv` and `/admin` refreshed in a browser need an index.html fallback in production.
- [ ] **Volume mounted at `/data`**, and `WALL_DB_PATH` pointing into it, or posts vanish on every redeploy.
- [ ] **`ADMIN_PIN` set in the host**, not in a committed file.
- [ ] **HTTPS URL**, because phones scanning a QR to an http:// address get warnings.
- [ ] **A fresh clone really boots** with two commands on a machine that is not yours. Test on a colleague's laptop or a clean container. This is acceptance criterion 14 and it is the single thing most likely to eat Monday's first hour.
- [ ] **Node and Java versions documented in the README**, since the Java-heavy half of the room may not have Node 20 installed at all.
- [ ] **Fork flow tested end to end** by you, from a second GitHub account if you have one: fork, branch, push, open a PR. Ten minutes now, zero confusion Monday.
- [ ] **The stripped public repo genuinely has no `.claude/`**, verified by cloning it fresh yourself.

---

## 12. Suggested order this weekend

**Saturday:** scaffold, config, migrations, deploy an empty-but-booting app to Railway with the volume. Get the URL. That is the risky infrastructure part and it is done.

**Sunday:** build the features through the loop with recorders running (spec and plan committed first, then the two parallel worktrees, then integrate, then admin). Harness script. Strip and publish the public repo. Generate QR codes.

**Monday morning:** post the arrival prompt on the live wall, open the two docs bookmarks, print the cue card.
