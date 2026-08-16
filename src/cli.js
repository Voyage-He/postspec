import process from "node:process";
import readline from "node:readline/promises";
import { AGENTS, initProject, parseAgentSelection, parseOptions, validateProject } from "./core.js";

const help = `PostSpec - project-level Agent Skill initializer

Usage:
  postspec init
  postspec init --agents codex,claude,cursor,gemini [--force]
  postspec validate

Running init without --agents starts an interactive Agent selector.
After initialization, ask the selected Agent to create or update project specs.
`;

export async function run(argv, io = console, cwd = process.cwd(), prompt = interactiveSelection) {
  const [command, ...rest] = argv;
  const { positional, options } = parseOptions(rest);

  switch (command) {
    case "init": {
      rejectUnexpected(positional, options, ["agents", "force", "name"]);
      const agents = options.agents
        ? parseAgentSelection(options.agents)
        : await prompt();
      const generated = await initProject(cwd, agents, {
        force: options.force === true,
        projectName: typeof options.name === "string" ? options.name : undefined,
      });
      io.log(formatResult(agents, generated));
      break;
    }
    case "validate": {
      rejectUnexpected(positional, options, []);
      const issues = await validateProject(cwd);
      if (issues.length > 0) throw new Error(`Codex PostSpec 校验失败：\n- ${issues.join("\n- ")}`);
      io.log("Codex PostSpec 校验通过");
      break;
    }
    case "help":
    case "--help":
    case "-h":
    case undefined:
      io.log(help);
      break;
    default:
      throw new Error(`未知命令 ${command}\n\n${help}`);
  }
}

function rejectUnexpected(positional, options, allowedOptions) {
  if (positional.length > 0) throw new Error(`不支持的位置参数：${positional.join(" ")}`);
  const unknown = Object.keys(options).filter((option) => !allowedOptions.includes(option));
  if (unknown.length > 0) throw new Error(`不支持的选项：${unknown.map((option) => `--${option}`).join("、")}`);
}

export async function interactiveSelection() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("非交互环境请使用 --agents，例如：postspec init --agents codex,claude");
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("选择需要生成 PostSpec skill 的 Agent：");
    const keys = Object.keys(AGENTS);
    keys.forEach((key, index) => console.log(`  ${index + 1}. ${AGENTS[key].label}`));
    console.log("可多选，例如 1,2；输入 all 选择全部。");
    const answer = (await rl.question("> ")).trim().toLowerCase();
    if (answer === "all") return keys;

    const selected = answer.split(",").map((item) => {
      const index = Number.parseInt(item.trim(), 10) - 1;
      return keys[index];
    });
    if (selected.some((agent) => !agent)) throw new Error("选择无效");
    return [...new Set(selected)];
  } finally {
    rl.close();
  }
}

function formatResult(agents, generated) {
  const labels = agents.map((agent) => AGENTS[agent].label).join("、");
  const files = generated.length > 0
    ? generated.map((file) => `  - ${file}`).join("\n")
    : "  - 没有覆盖已有文件";
  return `已为 ${labels} 初始化 PostSpec。\n${files}\n\n现在直接告诉 Agent：“使用 postspec 建立或更新相关功能的 spec。”。`;
}
