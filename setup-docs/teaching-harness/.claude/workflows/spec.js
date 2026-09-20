// Workshop copy — read the shape, not the phases.
// The lesson is the `phases` block below: each stage names its own model —
// haiku to classify, sonnet to scope, opus to join. That tiering is the part
// that transfers. Paths like apps/api and docs/specs come from the source repo
// and are not in this folder.

export const meta = {
  name: 'spec',
  description:
    'Stage 1 of the loop: classify -> scope -> join into a draft spec at docs/specs/<slug>/spec.md at the monorepo root, covering apps/api, apps/web or both. Intent only, no design. A human grills it and sets Status: approved, then runs /plan.',
  whenToUse:
    'Start of any non-trivial change in this monorepo, from a problem statement or a ticket id. The classify stage decides which apps it touches. Produces the draft spec the human gate approves. See .claude/skills/spec/SKILL.md.',
  phases: [
    { title: 'Classify', detail: 'complexity + apps -> how much scoping to do', model: 'haiku' },
    { title: 'Scope', detail: 'read-only facts: real paths, patterns, constraints', model: 'sonnet' },
    { title: 'Join', detail: 'EARS requirements -> draft spec.md', model: 'opus' },
  ],
}

const problem = (typeof args === 'string' ? args : args?.problem ?? '').trim()
if (!problem) throw new Error('Usage: /spec <problem statement>')

const CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    complexity: { enum: ['trivial', 'standard', 'complex'] },
    apps: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: { enum: ['api', 'web'] },
      description: 'which apps under apps/ this change touches; both when it is full-stack',
    },
    areas: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: { type: 'string' },
      description: 'codebase areas the scope stage must read, one short name each',
    },
    rationale: { type: 'string' },
  },
  required: ['complexity', 'apps', 'areas', 'rationale'],
}

const SCOPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    slug: { type: 'string', description: 'kebab-case slug naming the change, not the solution' },
    relevant_files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { path: { type: 'string' }, why: { type: 'string' } },
        required: ['path', 'why'],
      },
    },
    reuse: { type: 'array', items: { type: 'string' }, description: 'existing helpers/patterns already in the repo' },
    constraints: { type: 'array', items: { type: 'string' } },
    unknowns: { type: 'array', items: { type: 'string' }, description: 'questions the repo cannot answer' },
  },
  required: ['slug', 'relevant_files', 'reuse', 'constraints', 'unknowns'],
}

const JOIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    spec_path: { type: 'string' },
    slug: { type: 'string' },
    requirement_count: { type: 'integer' },
    needs_clarification_count: { type: 'integer' },
    summary: { type: 'string' },
  },
  required: ['spec_path', 'slug', 'requirement_count', 'needs_clarification_count', 'summary'],
}

phase('Classify')
const cls = await agent(
  `You are the classify stage of the spec pipeline for a monorepo holding a Python REST backend at apps/api and a TypeScript web frontend at apps/web. Each app's AGENTS.md names its own stack; you do not need it to route.

Problem: ${problem}

Size the SCOPING effort only. Decide from the problem statement which apps the change touches — "api", "web", or both when it is full-stack — then decide the complexity and name the areas of the codebase the scope stage must read before it can describe what already exists: trivial -> 1 area, standard -> 2-3, complex -> 4-6. An area is a short app-qualified name like "api: users service", "api: tenant filtering", "web: auth gateway", "web: sidebar organism". Do not design anything, do not pick planning lenses (that is the plan stage's job), and do not write any file.`,
  { model: 'haiku', effort: 'low', label: 'classify', phase: 'Classify', schema: CLASSIFY_SCHEMA },
)
if (!cls) throw new Error('Classify agent produced no report; nothing to scope.')
log(`classify: ${cls.complexity}, apps: ${cls.apps.join(', ')}, ${cls.areas.length} area(s): ${cls.areas.join(', ')}`)

phase('Scope')
const scope = await agent(
  `You are the scope stage of the spec pipeline. Ground the problem in this monorepo with FACTS only, no design.

Problem: ${problem}

Apps touched: ${cls.apps.join(', ')}

Areas to read (${cls.complexity}): ${cls.areas.join(', ')}

Read the root AGENTS.md, then apps/<app>/AGENTS.md for each app in the apps list — especially its "Stack profile for the loop" section — and the .claude/rules/<app>/*.md files its Rules map points at for the areas you touch; report the existing helpers and patterns those name. Grep/Glob the areas above until you can describe the current behaviour, the patterns already used and the constraints already enforced. Both apps are in this repo and both are writable: an endpoint or a message code the frontend needs and the backend does not have yet is simply part of the change, discovered by reading apps/api like any other code, not a blocker to report. Return: a kebab-case slug that names the change and not the solution, the real file paths that matter, each prefixed with apps/api/ or apps/web/ (verify each exists with Read or Glob before listing it), the existing helpers and patterns already in the repo, the constraints that apply, and every question the repo cannot answer as unknowns — never guess an answer. READ-ONLY: no writes, no formatters, no commands that mutate state.`,
  { model: 'sonnet', label: 'scope', phase: 'Scope', schema: SCOPE_SCHEMA },
)
if (!scope) throw new Error('Scope agent produced no report; nothing to spec against.')
log(`scope: slug=${scope.slug}, ${scope.relevant_files.length} relevant file(s), ${scope.unknowns.length} unknown(s)`)

phase('Join')
const specPath = `docs/specs/${scope.slug}/spec.md`
const join = await agent(
  `You are the join stage of the spec pipeline. Write one draft spec, and nothing else.

Problem (the requester's words — quote them verbatim in the Problem section, do not tidy them): ${problem}

Apps touched: ${cls.apps.join(', ')}

Scope facts (verified against the repo):
${JSON.stringify(scope, null, 2)}

Read .claude/skills/spec/SKILL.md, docs/specs/TEMPLATE-spec.md and docs/specs/STYLE.md, then copy the template to ${specPath} and fill every section. Get the date by running \`date +%F\`.

INTENT ONLY. Requirements say what must be true when the work is done, never how. EARS patterns only, "shall" as the only modal, Simplified Technical English, one acceptance check per requirement with the same numbering, and the non-goals written down including the tempting ones. No file paths, no task order, no layer names, no component names, no library choices — those are the plan stage's job, and a file path in a spec is a defect. The scope facts exist to make the requirements accurate, not to be copied into the file.

Every unknown from the scope facts, and every question you cannot answer from the repo, becomes a bullet under Open questions written exactly as "[NEEDS CLARIFICATION: <question>]". Ask for the specific fact you need. Guessing is forbidden. Status stays "draft" — you never approve your own spec. Append the first Decision log line: "- <date> spec: drafted from the problem statement, <n> requirement(s), <m> open question(s)". Write only ${specPath}; do not commit.`,
  { model: 'opus', effort: 'high', label: 'join', phase: 'Join', schema: JOIN_SCHEMA },
)
if (!join) throw new Error('Join agent produced no report; check whether the draft spec was written.')

log(
  `spec drafted at ${join.spec_path} (${join.requirement_count} requirement(s), ${join.needs_clarification_count} clarification(s)). HUMAN GATE: grill it against the checklist in .claude/skills/spec/SKILL.md, resolve every [NEEDS CLARIFICATION], set Status: approved, check with \`./scripts/loop-gate.sh spec docs/specs/${join.slug}/spec.md\`, then run /plan ${join.slug}`,
)
return { ...join, apps: cls.apps, complexity: cls.complexity, areas: cls.areas }
