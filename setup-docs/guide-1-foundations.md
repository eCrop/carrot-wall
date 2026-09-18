# Guide 1 · Foundations

**Day 1 · The Carrot Wall project · roughly 2 hours, at your pace**

By the end of this guide you will have the Carrot Wall running on your machine, you will have asked it questions like you would ask a colleague who knows the codebase, and your clone will have its first CLAUDE.md. That last file matters more than it looks: it is the first piece of the harness you will build all week.

Work at your own speed. If you finish early, there is a stretch section at the end. If you get stuck, put it on the wall or flag me down. Getting stuck is normal and usually more instructive than the happy path.

---

## Before you start

You need three things installed. Check them in a terminal:

```
java -version     # 21 or newer
node -v           # 20 or newer
claude --version  # any recent version; run `claude update` if in doubt
```

If Java or Node are missing, grab them now and wave me over if the install fights you. One more thing from this morning: make sure you are signed into the company workspace, not a personal account. Real code only travels on the right accounts.

## Step 1 · Fork it, clone it, run it

Open the repo at `<REPO_URL>` and click **Fork**, top right. That gives you your own full copy under your own GitHub account. You will work there all week, and nothing you do can affect anyone else's copy.

Then clone *your* fork (the URL with your username in it):

```
git clone https://github.com/<your-username>/carrot-wall.git
cd carrot-wall
```

Two apps, two terminals:

```
# terminal 1, the API
cd apps/api
./mvnw quarkus:dev
```

```
# terminal 2, the web app
cd apps/web
npm install
npm start
```

Open http://localhost:4200. You should see the wall with a few seeded posts. If you see it, you are done with setup. If you do not, the two usual suspects are a busy port and a Node version below 20. Fix or flag.

Now create a branch to work on. Everything you do this week goes here, on your own fork:

```
git checkout -b day1-setup
git push -u origin day1-setup
```

At the end of each day, open a **pull request** from your branch back to the original repo. GitHub offers it automatically after you push: the *Compare & pull request* button, with the base repository set to the original and the base branch `main`. Nothing gets merged; the pull request is simply where I read your work and leave comments between sessions. You will do this for the first time at the end of today.

## Step 2 · Interrogate the codebase

This is the exercise. You just cloned a project you have never seen. Instead of reading files for an hour, ask.

Start Claude Code at the repo root:

```
cd ../..   # back to the repo root
claude
```

Then ask it the kind of questions you would ask the senior developer who wrote this. Ask at least five. Some to steal, but yours will be better because you are curious about different things:

- How does a post get from the submit form to the wall? Walk me through every file involved.
- Where is the rate limit enforced, and what exactly happens when someone hits it?
- What would I need to touch to add a new post type? List the files.
- Explain the Flyway migrations in this repo. What does each one set up?
- Why does the wall update without a page reload? Show me the mechanism.
- What is the ugliest part of this codebase, and why?

Two habits to practice while you do this:

**Check the citations.** A good answer names real files and real lines. When it does, open one and confirm. When an answer feels confident but cites nothing, be suspicious. You are calibrating your trust, and that calibration is the actual skill here.

**Watch your context.** Run `/context` once mid-session and look at what is taking up space. We will talk a lot more about this on Wednesday, but it is good to see the numbers early.

**Goal:** three answers that cite real files and survive your checking.

## Step 3 · Write your first CLAUDE.md

CLAUDE.md is the file Claude Code reads at the start of every session in this project. It is where the knowledge lives that you would otherwise repeat every day: how to run things, what the conventions are, what not to touch.

Create `CLAUDE.md` at the repo root. Here is a starter shape. Do not copy it blindly, make it true for what you learned in Step 2:

```markdown
# Carrot Wall

A live wall for course posts. Angular web app plus a Quarkus API, H2 database, Flyway migrations.

## Commands

- API: `cd apps/api && ./mvnw quarkus:dev` (port 8080)
- Web: `cd apps/web && npm start` (port 4200)
- API tests: `cd apps/api && ./mvnw test`
- Web tests: `cd apps/web && npm test`

## Conventions

- <what you noticed: naming, structure, where things live>

## Rules

- Never edit files under `apps/api/src/main/resources/db/migration/` that already exist. New schema changes get a new migration file.
- <one rule of your own, from something that surprised you today>
```

A tip on how to write it: ask Claude to draft it for you from what it now knows about the repo, then edit it by hand, ruthlessly. Generated context files tend to be generic and generic is worse than nothing. The valuable lines are the surprising ones, the things an agent could not guess. One specific rule beats three paragraphs of description. And keep the habit the tool's creator recommends: update this file whenever Claude makes a mistake, so it learns not to repeat it.

When it reads true, commit it and push:

```
git add CLAUDE.md
git commit -m "Add CLAUDE.md"
git push
```

Then start a fresh Claude Code session and ask one of your Step 2 questions again. Notice the difference a little memory makes.

## If you get stuck

Post it on the wall, or orange sticky and I will come around. The three most common snags today: a port already in use, Node below 20, and being signed into the wrong account. All three take a minute to fix.

## Take it home

Tonight or tomorrow, repeat Step 2 and Step 3 on one of your real repos. Ten minutes of questions, one honest CLAUDE.md. That is the whole assignment. Bring what you notice; it will be useful on Wednesday when we talk about shared memory.

If you are curious, the wall's own `spec.md` and `plan.md` sit in the repo root. They are tomorrow's opening exhibit. Reading them tonight is optional and quietly useful.

## Stretch, if you finished early

- Ask Claude Code to draw you the module map of `apps/web` and check it against the folder structure.
- Ask for the history of the gnarliest file: what it does, why it might have ended up this way.
- Find something small that bothers you in the code. Do not fix it yet. Write it down. You will want it tomorrow, when we pick features from `feature-ideas.md` and size them.
