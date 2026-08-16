import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initProject, parseAgentSelection, skillTemplate, validateProject } from "../src/core.js";
import { run } from "../src/cli.js";

async function fixture() {
  return mkdtemp(path.join(os.tmpdir(), "postspec-"));
}

test("generates selected project-level agent skills and shared scaffold", async () => {
  const cwd = await fixture();
  const generated = await initProject(cwd, ["codex", "claude"], { projectName: "demo" });

  assert.ok(generated.includes(".agents/skills/postspec/SKILL.md"));
  assert.ok(generated.includes(".claude/skills/postspec/SKILL.md"));

  const codexSkill = await readFile(path.join(cwd, ".agents/skills/postspec/SKILL.md"), "utf8");
  const config = await readFile(path.join(cwd, "openspec/config.yaml"), "utf8");
  assert.equal(codexSkill, skillTemplate());
  assert.match(config, /Project: "demo"/);
  assert.ok(generated.includes("openspec/specs/.gitkeep"));
  assert.ok(generated.includes(".agents/skills/postspec/agents/openai.yaml"));
  assert.ok(generated.includes(".agents/skills/postspec/assets/spec-template.md"));
  assert.deepEqual((await readdir(path.join(cwd, "openspec"))).sort(), ["config.yaml", "specs"]);
  assert.deepEqual(await readdir(path.join(cwd, ".agents/skills/postspec/assets")), ["spec-template.md"]);
  assert.deepEqual(await validateProject(cwd), []);
});

test("reports incomplete or malformed Codex skill scaffolds", async () => {
  const cwd = await fixture();
  await initProject(cwd, ["codex"]);
  await writeFile(path.join(cwd, ".agents/skills/postspec/SKILL.md"), "# broken\n");

  const issues = await validateProject(cwd);
  assert.ok(issues.some((issue) => issue.includes("frontmatter")));
  assert.ok(issues.some((issue) => issue.includes("spec-template.md")));
});

test("does not overwrite an existing skill unless force is enabled", async () => {
  const cwd = await fixture();
  await initProject(cwd, ["cursor"]);
  const skill = path.join(cwd, ".cursor/skills/postspec/SKILL.md");
  await writeFile(skill, "custom");

  await initProject(cwd, ["cursor"]);
  assert.equal(await readFile(skill, "utf8"), "custom");

  await initProject(cwd, ["cursor"], { force: true });
  assert.equal(await readFile(skill, "utf8"), skillTemplate());
});

test("supports non-interactive init and validates agent names", async () => {
  const cwd = await fixture();
  const output = [];
  await run(["init", "--agents", "gemini,codex"], { log: (value) => output.push(value) }, cwd);

  assert.match(output[0], /Gemini CLI、Codex/);
  assert.deepEqual(parseAgentSelection("codex,codex,claude"), ["codex", "claude"]);
  assert.throws(() => parseAgentSelection("unknown"), /不支持的 Agent/);
  assert.throws(() => parseAgentSelection(true), /--agents 需要/);
});

test("runs Codex validation through the CLI and rejects unknown options", async () => {
  const cwd = await fixture();
  const output = [];
  const io = { log: (value) => output.push(value) };
  await run(["init", "--agents", "codex"], io, cwd);
  await run(["validate"], io, cwd);

  assert.equal(output.at(-1), "Codex PostSpec 校验通过");
  await assert.rejects(run(["validate", "--unknown"], io, cwd), /不支持的选项/);
  await assert.rejects(run(["init", "extra", "--agents", "codex"], io, cwd), /不支持的位置参数/);
});

test("force refresh preserves existing specs and other user documents", async () => {
  const cwd = await fixture();
  await initProject(cwd, ["codex"]);
  const files = ["openspec/specs/login/spec.md", "docs/notes.md"];
  for (const file of files) {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
    await writeFile(path.join(cwd, file), "user content");
  }
  await writeFile(path.join(cwd, ".agents/skills/postspec/SKILL.md"), "custom skill");
  await writeFile(path.join(cwd, "openspec/config.yaml"), "schema: custom\ncontext: preserved\n");
  await initProject(cwd, ["codex"], { force: true, projectName: "demo" });
  assert.equal(await readFile(path.join(cwd, ".agents/skills/postspec/SKILL.md"), "utf8"), skillTemplate());
  assert.equal(await readFile(path.join(cwd, "openspec/config.yaml"), "utf8"), 'schema: custom\ncontext: preserved\n');
  for (const file of files) assert.equal(await readFile(path.join(cwd, file), "utf8"), "user content");
  assert.deepEqual(await validateProject(cwd), []);
});
