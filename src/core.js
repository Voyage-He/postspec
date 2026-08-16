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
    ["openspec/config.yaml", configTemplate(projectName)],
    ["openspec/specs/.gitkeep", ""],
  ];

  for (const [relativePath, content] of scaffold) {
    if (await writeGeneratedFile(cwd, relativePath, content, relativePath === "openspec/config.yaml" ? false : force)) generated.push(relativePath);
  }

  for (const agent of agents) {
    const skillFiles = [
      ["SKILL.md", skillTemplate()],
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
    "openspec/config.yaml",
    "openspec/specs",
    ".agents/skills/postspec/SKILL.md",
    ".agents/skills/postspec/agents/openai.yaml",
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
    for (const template of ["spec-template.md"]) {
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

  const configPath = path.join(cwd, "openspec/config.yaml");
  if (await exists(configPath)) {
    const config = await readFile(configPath, "utf8");
    if (!/^schema:\s*[^\s#]+/m.test(config)) {
      issues.push("openspec/config.yaml 必须包含 OpenSpec 兼容的 schema 字段");
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
  return `schema: spec-driven
context: |
  Project: ${JSON.stringify(projectName)}
`;
}

export function skillTemplate() {
  return `---
name: postspec
description: Automatically create and update project specs from code, tests, and user feedback. Use when documenting existing capabilities, synchronizing specs after code changes, or revising a spec.
---

# PostSpec

Maintain durable capability specs directly in \`openspec/specs/<capability>/spec.md\` using short lowercase kebab-case names. Create the directory when needed. Create and update specs autonomously.

Read relevant code, tests, existing specs, and the user's feedback before writing. Keep affected specs synchronized with the current code. A spec request authorizes documentation edits; application code edits follow the user's requested scope.

- Decide which affected capabilities need durable documentation. Create a spec for a new capability or semantically update the existing spec for that capability; keep one coherent description of each capability.
- Capture observable behavior, important constraints and invariants, and decisions or lessons that will guide future changes. Skip incidental details that add no durable value. An explicit request to document a capability is sufficient reason to create its spec.
- Use \`assets/spec-template.md\` for new specs, adapting the structure and removing unused sections and placeholders. Existing specs may keep their own structure.
- Describe current behavior supported by code and tests. Distinguish verified results from untested assumptions and intended behavior. If user feedback conflicts with the code, make the discrepancy clear and ask only when resolving it requires a product decision.
- Before modifying any spec, read its current on-disk content. Apply focused semantic edits, reconcile outdated statements, and preserve unrelated human edits. Do not regenerate an entire document when a local update is sufficient.
- Keep specs focused on current capabilities. Preserve useful rationale when updating outdated behavior.

Finish with a brief report of specs created or updated and any unresolved discrepancies. If no update is warranted, explain why briefly. Do not stop at recommending edits when you can make them.
`;
}

export function openaiYamlTemplate() {
  return `interface:
  display_name: "PostSpec"
  short_description: "Automatically create and update project specs"
  default_prompt: "Use $postspec to create or update specs for the relevant capabilities based on current code, tests, and my feedback."
policy:
  allow_implicit_invocation: true
`;
}

export function specTemplate() {
  return `# <Capability name>

## Purpose

<Durable user or system value provided by this capability.>

## Behavior

- <Observable behavior supported by the current code.>

## Constraints and invariants

- <Rule this capability must preserve.>

## Decisions and rationale

- <Important decision or recurring lesson and why it matters.>

## Verification

- <Relevant code or test references, verified results, and any unverified assumptions.>
`;
}
