# PostSpec

PostSpec 是一个纯 Agent Skill：让 AI 编程 Agent 根据当前代码、测试和用户反馈，直接建立和维护 `openspec/specs/` 中的功能规范。代码变化时同步更新相关 Spec，也可以单独为已有项目补充文档。

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

在目标项目中让 Agent 使用 PostSpec，例如：

```text
使用 postspec，为现有登录功能建立 spec。
```

```text
修改登录逻辑，并使用 postspec 同步相关 spec。
```

```text
使用 postspec，根据最新代码和测试同步现有 spec。
```

```text
使用 postspec，结合我对登录 spec 的修改和当前代码补充边界条件。
```

Agent 会按需创建目录，规范按能力组织：

```text
openspec/
└── specs/
    └── login/
        └── spec.md
```

Spec 记录当前行为、约束、不变量和有长期价值的决策。更新前读取磁盘上的最新内容，保留无关人工修改；未实现的功能不会写成已实现的事实。仅请求文档时，修改范围为规范文档。

不需要预先初始化目录或创建 `openspec/config.yaml`；已有配置保持不变。自动维护发生在 Agent 使用此 Skill 执行相关任务时，没有后台文件监听器。

## 更新与旧版迁移

更新时将新版 `SKILL.md`、`agents/` 和 `assets/` 复制到原 Skill 目录。复制会替换同名 Skill 文件；如果曾手动修改这些文件，请先合并需要保留的内容。项目的 `openspec/specs/` 和已有配置不受影响。

旧版 CLI 已移除，原有 Spec 可以继续使用。曾通过 `npm link` 注册命令的用户，可运行 `npm uninstall -g postspec` 移除旧的全局链接，再按上面的步骤安装 Skill。此清理仅针对旧版安装，新版无需 npm。
