import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const AGENTS = {
  codex: {
    label: "Codex",
    skillDir: ".agents/skills/postspec",
  },
  claude: {
    label: "Claude Code",
    skillDir: ".claude/skills/postspec",
  },
  cursor: {
    label: "Cursor",
    skillDir: ".cursor/skills/postspec",
  },
  gemini: {
    label: "Gemini CLI",
    skillDir: ".gemini/skills/postspec",
  },
};

export function parseOptions(args) {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { positional, options };
}

export function parseAgentSelection(value) {
  if (typeof value !== "string") throw new Error("--agents 需要逗号分隔的 Agent 名称");
  const selected = [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
  const invalid = selected.filter((agent) => !AGENTS[agent]);
  if (invalid.length > 0) {
    throw new Error(`不支持的 Agent：${invalid.join("、")}`);
  }
  if (selected.length === 0) throw new Error("至少选择一个 Agent");
  return selected;
}

export async function initProject(cwd, agents, options = {}) {
  const force = options.force ?? false;
  const projectName = options.projectName ?? path.basename(cwd);
  const generated = [];

  const scaffold = [
    ["postspec/config.yaml", configTemplate(projectName)],
    ["postspec/changes/.gitkeep", ""],
    ["postspec/specs/.gitkeep", ""],
    ["postspec/archive/.gitkeep", ""],
  ];

  for (const [relativePath, content] of scaffold) {
    if (await writeGeneratedFile(cwd, relativePath, content, force)) generated.push(relativePath);
  }

  for (const agent of agents) {
    const skillFiles = [
      ["SKILL.md", skillTemplate()],
      ["assets/proposal-template.md", proposalTemplate()],
      ["assets/discuss-template.md", discussTemplate()],
      ["assets/spec-template.md", specTemplate()],
    ];
    if (agent === "codex") skillFiles.push(["agents/openai.yaml", openaiYamlTemplate()]);

    for (const [skillPath, content] of skillFiles) {
      const relativePath = path.join(AGENTS[agent].skillDir, skillPath);
      if (await writeGeneratedFile(cwd, relativePath, content, force)) generated.push(relativePath);
    }
  }

  return generated;
}

export async function validateProject(cwd) {
  const issues = [];
  const requiredPaths = [
    "postspec/config.yaml",
    "postspec/changes",
    "postspec/specs",
    "postspec/archive",
    ".agents/skills/postspec/SKILL.md",
    ".agents/skills/postspec/agents/openai.yaml",
    ".agents/skills/postspec/assets/proposal-template.md",
    ".agents/skills/postspec/assets/discuss-template.md",
    ".agents/skills/postspec/assets/spec-template.md",
  ];

  for (const relativePath of requiredPaths) {
    if (!(await exists(path.join(cwd, relativePath)))) issues.push(`缺少 ${relativePath}`);
  }

  const skillPath = path.join(cwd, ".agents/skills/postspec/SKILL.md");
  if (await exists(skillPath)) {
    const skill = await readFile(skillPath, "utf8");
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatter) {
      issues.push("SKILL.md 缺少有效的 YAML frontmatter");
    } else {
      const keys = [...frontmatter[1].matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((match) => match[1]);
      if (!keys.includes("name") || !/^name: postspec$/m.test(frontmatter[1])) {
        issues.push("SKILL.md 的 name 必须是 postspec");
      }
      if (!keys.includes("description") || !/^description: .+/m.test(frontmatter[1])) {
        issues.push("SKILL.md 必须包含非空 description");
      }
      const extraKeys = keys.filter((key) => !["name", "description"].includes(key));
      if (extraKeys.length > 0) issues.push(`SKILL.md frontmatter 包含不支持的字段：${extraKeys.join("、")}`);
    }
    for (const template of ["proposal-template.md", "discuss-template.md", "spec-template.md"]) {
      if (!skill.includes(`assets/${template}`)) issues.push(`SKILL.md 未引用 assets/${template}`);
    }
  }

  const openaiPath = path.join(cwd, ".agents/skills/postspec/agents/openai.yaml");
  if (await exists(openaiPath)) {
    const metadata = await readFile(openaiPath, "utf8");
    if (!/default_prompt: "[^"]*\$postspec[^"]*"/.test(metadata)) {
      issues.push("agents/openai.yaml 的 default_prompt 必须显式引用 $postspec");
    }
    if (!/allow_implicit_invocation: true/.test(metadata)) {
      issues.push("agents/openai.yaml 必须允许隐式触发");
    }
  }

  return issues;
}

async function writeGeneratedFile(cwd, relativePath, content, force) {
  const target = path.join(cwd, relativePath);
  if (!force && await exists(target)) return false;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  return true;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function configTemplate(projectName) {
  return `project: ${yamlString(projectName)}
version: 1
workflow:
  - proposal
  - implementation
  - spec
`;
}

function yamlString(value) {
  return JSON.stringify(value);
}

export function skillTemplate() {
  return `---
name: postspec
description: Drive PostSpec's lightweight three-stage specification workflow for feature development. Use when the user asks to clarify a feature proposal, implement an approved proposal, continue or revise an implementation, or solidify final behavior and lessons into a spec.
---

# PostSpec

Use exactly three stages: proposal, implementation, and spec. Do not introduce plan or tasks documents.

Store work under:

\`\`\`text
postspec/
├── changes/<change-name>/
│   ├── proposal.md
│   ├── discuss.md
│   └── specs/
│       └── <capability>.md
├── specs/<capability>.md
└── archive/<change-name>/
\`\`\`

Use a short lowercase kebab-case change name. Keep \`discuss.md\` concise; preserve only important decisions, discoveries, requirement corrections, and verification results rather than a transcript.

Use the bundled templates instead of inventing document structures:

- Copy \`assets/proposal-template.md\` when creating a proposal.
- Copy \`assets/discuss-template.md\` when the first important implementation discussion must be recorded.
- Copy \`assets/spec-template.md\` for each candidate capability spec.
- Replace template placeholders and remove unused optional sections before human review.

## 1. Proposal

Start here for a new change.

1. Inspect relevant repository context before assuming the solution.
2. Discuss the request over as many turns as needed. Ask about unclear goals, scope, non-goals, constraints, acceptance behavior, and important technical choices.
3. Do not implement while important product questions remain unresolved.
4. Create or update \`postspec/changes/<change-name>/proposal.md\` with:
   - Why
   - Required behavior
   - Scope
   - Explicit non-goals
   - Technical direction and constraints
   - Resolved decisions
   - Open questions
5. Do not create \`discuss.md\` during proposal. Keep proposal-stage conclusions in \`proposal.md\`.
6. Ask the user to confirm the proposal before implementation. Continue discussion and update the proposal when they do not confirm it.
7. After explicit approval, replace \`Status: draft\` with \`Status: approved\` near the top of \`proposal.md\`. This marker is the only persistent stage signal required.

## 2. Implementation

Enter only after the user approves the proposal.

1. Verify that \`proposal.md\` contains \`Status: approved\`, then implement directly from it without creating plan or tasks artifacts.
2. Inspect the codebase, choose implementation details autonomously, edit code, and run appropriate tests.
3. Continue through multiple rounds of testing, feedback, discussion, and revision.
4. Treat code and tests as the current facts. If implementation reveals a wrong or missing requirement, discuss it and update the proposal.
5. Create and maintain \`discuss.md\` as the single implementation-stage discussion record. Keep only meaningful:
   - human and Agent decisions that materially affected the implementation
   - important implementation choices and deviations from proposal
   - verification results that changed confidence or direction
   - newly discovered constraints and requirement corrections
   - candidate lessons for the final spec
   Do not copy the full conversation or routine progress updates.
6. Do not move to spec merely because code was written. Ask the user to confirm implementation is final.

## 3. Spec, review, and archive

Enter only after the user confirms the implementation is final and repository inspection finds a completed implementation or other verifiable final result.

1. Inspect the final code and tests first, then read the proposal and \`discuss.md\`. A user's statement that implementation is final does not override contradictory repository evidence.
2. If implementation is missing, still blocked, or not verifiable, do not enter spec or completed-change archival. Explain the mismatch and remain in implementation. If the user explicitly cancels the change, mark \`Status: cancelled\` in \`proposal.md\` and archive it without creating or modifying main specs.
3. Identify every affected module or capability and decide independently whether each one needs a durable spec update. A single change may produce zero, one, or multiple candidate specs. Do not stop at recommendations or ask for approval during this stage; complete the analysis and file updates autonomously.
4. Create no durable spec for a capability when the change is incidental, fully obvious from ordinary code and tests, unlikely to guide future decisions, or contains no important behavioral contract or lesson.
5. For each candidate that passes the necessity test, draft \`postspec/changes/<change-name>/specs/<capability>.md\`. Each candidate must cover one coherent module or capability and contain:
   - required behavior
   - explicit non-goals
   - important constraints and invariants
   - decisions necessary to understand future changes
   - lessons worth preserving
   Split candidates by durable capability boundaries, not by files changed or implementation layers.
6. For each candidate lesson, decide whether it belongs in the candidate spec:
   - Keep it when it is likely to recur, changes future design choices, prevents a plausible repeated mistake, or exposes a previously hidden invariant.
   - Reject it when it was an incidental error, a low-probability event, a temporary tool issue, an ordinary implementation detail, or already sufficiently captured by tests.
7. For each preserved lesson, state what was discovered, why it was not apparent during proposal, and why it matters in future work.
8. Solidify every candidate autonomously:
   - When it defines a new durable capability, create \`postspec/specs/<capability>.md\` from the candidate without moving, deleting, or emptying the candidate file.
   - Semantically merge it into one or more main specs when it changes existing capabilities. Reconcile contradictions and preserve the final truth; do not append a change log.
   - Split or combine candidates when the durable capability boundaries require it.
   - Reject candidates that do not pass the necessity test; do not add them to main specs.
   - Keep every accepted candidate as a non-empty change-local snapshot under \`postspec/changes/<change-name>/specs/\`. Main specs and change specs serve different purposes and must both remain on disk.
9. After all main specs are created or updated, keep \`postspec/changes/<change-name>/\` active and stop before archival. This is the human-review checkpoint. The same checkpoint applies when no durable spec was created.
10. Ensure main specs describe final facts rather than narrating the development process.
11. Report which main specs were created, merged, left unchanged, or intentionally omitted. Tell the user that spec work is ready for review and that the change has not been archived.

## Human review follow-up

Human review happens after the autonomous spec work and before archival. The user may inspect and edit specs in any internal or external editor, then continue the conversation with corrections.

- When asked to revise a spec, inspect its current on-disk content first. Treat human edits as the current authoritative draft.
- Use final code, tests, the active change's proposal/discussion, and the user's feedback to update the relevant main specs directly.
- Keep the corresponding change-local candidate specs synchronized with the reviewed result so they remain useful historical snapshots after archival. Never delete or truncate them after merging into main specs.
- Preserve unrelated human edits and avoid regenerating whole specs when a focused semantic update is sufficient.
- Keep the active change unarchived through any review-and-revision rounds.
- Archive only after the user explicitly confirms that human review is complete and asks to archive. Before moving anything, verify that every accepted change spec still exists and is non-empty. If one is missing or empty, restore it from the reviewed result and do not archive until the snapshot is complete. Then move the entire \`postspec/changes/<change-name>/\` directory, including its populated \`specs/\` directory, to \`postspec/archive/<change-name>/\`. Never overwrite an existing archive.
- Do not treat silence, a general acknowledgement, or a request to inspect/update specs as archive approval.

## Guardrails

- Do not silently advance between stages.
- Do not invent requirements to make the proposal look complete.
- Do not let stale proposal text override final verified code; reconcile discrepancies with the user.
- Do not treat a user's completion claim as proof when code, tests, or discussion show the implementation is missing or blocked.
- Do not turn the spec into an incident log or implementation diary.
- Do not stop the spec stage at analysis or recommendations; complete the durable spec updates autonomously.
- Never archive a completed change before explicit human confirmation that spec review is complete.
- Never use a filesystem move for a change spec when solidifying it into the main spec collection; archived changes must retain their accepted spec snapshots.
`;
}

export function openaiYamlTemplate() {
  return `interface:
  display_name: "PostSpec"
  short_description: "Three-stage AI development specification workflow"
  default_prompt: "Use $postspec to clarify, implement, and solidify this change."
policy:
  allow_implicit_invocation: true
`;
}

export function proposalTemplate() {
  return `# Proposal: <change title>

Status: draft

## Why

<Problem and why it matters now.>

## Required behavior

- <Observable, testable behavior.>

## Scope

- <Included behavior or affected capability.>

## Explicit non-goals

- <Behavior intentionally excluded.>

## Technical direction and constraints

- <Important stack choices, compatibility constraints, and invariants.>

## Resolved decisions

- <Decision and concise rationale.>

## Open questions

- <Question that must be resolved before approval, or "None".>
`;
}

export function discussTemplate() {
  return `# Implementation discussion: <change title>

<!-- Keep only entries that materially affect implementation or the final specs. -->

## <decision or discovery>

- Context: <What prompted this discussion.>
- Decision: <What the human and Agent concluded.>
- Evidence: <Relevant code, test, or observed behavior.>
- Impact: <Effect on implementation, proposal, or candidate specs.>
`;
}

export function specTemplate() {
  return `# <Capability name>

## Purpose

<Durable user or system value provided by this capability.>

## Required behavior

- <Observable, verifiable final behavior.>

## Explicit non-goals

- <Behavior this capability intentionally does not provide.>

## Constraints and invariants

- <Rule future implementations and changes must preserve.>

## Previously unspecified behavior

- <Final behavior or assumption that was unclear before implementation, and why it was missed.>

## Lessons worth preserving

### <Lesson>

- Discovery: <What was learned.>
- Why it was not apparent during proposal: <Reason.>
- Future importance: <How this prevents a plausible repeated mistake or guides design.>
`;
}
