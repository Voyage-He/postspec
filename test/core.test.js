import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  const config = await readFile(path.join(cwd, "postspec/config.yaml"), "utf8");
  assert.match(codexSkill, /Use exactly three stages/);
  assert.match(codexSkill, /Do not introduce plan or tasks documents/);
  assert.match(codexSkill, /Reject it when it was an incidental error/);
  assert.match(codexSkill, /Status: approved/);
  assert.match(codexSkill, /single implementation-stage discussion record/);
  assert.doesNotMatch(codexSkill, /discussion\.md|implementation\.md/);
  assert.match(codexSkill, /Do not stop at recommendations or ask for approval/);
  assert.match(codexSkill, /Semantically merge it/);
  assert.match(codexSkill, /zero, one, or multiple candidate specs/);
  assert.match(codexSkill, /Solidify every candidate autonomously/);
  assert.match(codexSkill, /candidate that passes the necessity test/);
  assert.doesNotMatch(codexSkill, /approved candidate|wait for explicit human approval|review every candidate/);
  assert.match(codexSkill, /Human review happens after/);
  assert.match(codexSkill, /Treat human edits as the current authoritative draft/);
  assert.match(codexSkill, /This is the human-review checkpoint/);
  assert.match(codexSkill, /Archive only after the user explicitly confirms/);
  assert.match(codexSkill, /Never archive a completed change before explicit human confirmation/);
  assert.match(codexSkill, /without moving, deleting, or emptying the candidate file/);
  assert.match(codexSkill, /every accepted change spec still exists and is non-empty/);
  assert.match(codexSkill, /including its populated `specs\/` directory/);
  assert.match(codexSkill, /Never use a filesystem move for a change spec/);
  assert.doesNotMatch(codexSkill, /spec and archive work|complete the durable spec updates and archival autonomously/);
  assert.match(codexSkill, /changes\/<change-name>\/specs\/<capability>\.md/);
  assert.match(codexSkill, /Status: cancelled/);
  assert.match(codexSkill, /does not override contradictory repository evidence/);
  assert.match(codexSkill, /archive\/<change-name>/);
  assert.match(config, /project: "demo"/);
  assert.match(config, /- proposal/);
  assert.ok(generated.includes("postspec/archive/.gitkeep"));
  assert.ok(generated.includes(".agents/skills/postspec/agents/openai.yaml"));
  assert.ok(generated.includes(".agents/skills/postspec/assets/proposal-template.md"));
  assert.deepEqual(await validateProject(cwd), []);
});

test("reports incomplete or malformed Codex skill scaffolds", async () => {
  const cwd = await fixture();
  await initProject(cwd, ["codex"]);
  await writeFile(path.join(cwd, ".agents/skills/postspec/SKILL.md"), "# broken\n");

  const issues = await validateProject(cwd);
  assert.ok(issues.some((issue) => issue.includes("frontmatter")));
  assert.ok(issues.some((issue) => issue.includes("proposal-template.md")));
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
