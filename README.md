# PostSpec

PostSpec 是一个纯 Agent Skill：每轮迭代结束后，让 AI 根据更新后的代码，以及本轮会话中确认的**应当遵循的约定、明确不做的事项和后续计划**，自动更新 `openspec/specs/` 中的功能规范。

## 理念

AI 越来越聪明，能够理解代码、完成实现，并从讨论中提炼重要决策。我们相信，开发者可以逐渐减少对执行过程的干预，把注意力放在目标、反馈和关键取舍上。

因此，PostSpec 的工作方式很简单：**先迭代，再把值得保留的上下文沉淀为 spec。** 无需在每次改动前写出详尽规范，也无需为维护文档增加一套繁琐流程。正常与 AI 讨论、开发和调整，迭代结束时由 AI 同步相关 spec，让下一轮工作有据可循。

代码说明系统现在如何工作，本轮会话则补充代码本身无法完整表达的意图：

| 内容 | Spec 应保留什么 |
| --- | --- |
| **应当遵循** | 已确认要遵循的行为、约束和做法，以及必要的原因。 |
| **明确不做** | 明确不做的事情、需要避免的做法和不能突破的边界。 |
| **后续计划** | 已确认但尚未实现的后续计划，明确标注为待办或预期行为。 |

Spec 是随项目演进的长期记忆。它保留当前行为和对后续迭代有价值的约定，不必复述整段聊天或记录每个实现细节。尚在讨论的想法不能当成已确认的决定，未来计划也不能写成已经实现的功能。

## 工作方式

1. **正常迭代**：与 AI 讨论需求、修改代码、验证结果，按需给出反馈。
2. **自动沉淀**：迭代结束后，AI 对照最新代码、测试和已有 spec，提炼本轮会话中应当遵循的约定、明确不做的事项和后续计划。
3. **同步 Spec**：更新受影响的规范，修正过时描述，保留仍然有效的约定和无关人工修改；没有值得沉淀的变化时，无需为了更新而更新。

自动维护发生在 Agent 使用此 Skill 执行相关任务时，没有后台文件监听器。可以在开始协作时约定每轮结束后使用 PostSpec，也可以单独为已有项目补充规范。

Skill 运行无需 Node.js、npm 或 CLI。可通过复制文件或 npm 获取，安装后直接与 Agent 对话。

## 安装

本仓库根目录就是 Skill 源目录：

```text
postspec/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── assets/
    └── spec-template.md
```

将 `SKILL.md`、`agents/` 和 `assets/` 复制到目标项目的 Skill 目录。以下示例在本仓库目录执行，为 Codex 安装：

```bash
mkdir -p /path/to/your-project/.agents/skills/postspec
cp -R SKILL.md agents assets /path/to/your-project/.agents/skills/postspec/
```

也可以在目标项目中通过 npm 获取 Skill，再复制到 Agent 的 Skill 目录：

```bash
npm install --save-dev postspec
mkdir -p .agents/skills/postspec
cp -R node_modules/postspec/SKILL.md node_modules/postspec/agents node_modules/postspec/assets .agents/skills/postspec/
```

npm 包只分发 Skill 文件，不提供命令或安装脚本。安装 npm 包后仍需复制文件，让 Agent 发现 Skill；更新 npm 包后也需重新复制。

其他 Agent 可使用对应目录：

| Agent | 目标项目中的 Skill 目录 |
| --- | --- |
| Codex | `.agents/skills/postspec/` |
| Claude Code | `.claude/skills/postspec/` |
| Cursor | `.cursor/skills/postspec/` |
| Gemini CLI | `.gemini/skills/postspec/` |

`agents/openai.yaml` 提供 Codex 的展示信息和调用策略。其他 Agent 是否加载 Skill 取决于其自身支持，尚未验证行为一致性。

## 使用

在目标项目中，可以在开始协作时告诉 Agent：

```text
每轮迭代结束后使用 postspec，根据更新后的代码和本轮会话中
确认的应当遵循的约定、明确不做的事项和后续计划，自动更新相关 spec。
区分当前已实现的行为、必须遵守的约束和后续计划。
```

也可以针对单次任务使用：

```text
修改登录逻辑，并使用 postspec 将实现结果和本轮确认的关键约定同步到 spec。
```

```text
使用 postspec，根据当前代码和测试，为现有登录功能建立 spec。
```

Agent 会按需创建目录，规范按能力组织：

```text
openspec/
└── specs/
    └── login/
        └── spec.md
```

更新前读取磁盘上的最新 spec，在相关位置做语义更新。仅请求文档时，修改范围为规范文档。

不需要预先初始化目录或创建 `openspec/config.yaml`；已有配置保持不变。

## 更新与旧版迁移

更新时将新版 `SKILL.md`、`agents/` 和 `assets/` 复制到原 Skill 目录。复制会替换同名 Skill 文件；如果曾手动修改这些文件，请先合并需要保留的内容。项目的 `openspec/specs/` 和已有配置不受影响。

旧版 CLI 已移除，原有 Spec 可以继续使用。曾通过 `npm link` 注册命令的用户，可运行 `npm uninstall -g postspec` 移除旧的全局链接，再按上面的步骤安装 Skill。此清理仅针对旧版安装，新版无需 npm。
