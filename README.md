# PostSpec

PostSpec 为 AI 编程 Agent 安装自动建立、修改 Spec 的能力。Agent 根据当前代码、测试和用户反馈，直接维护 `openspec/specs/` 中的功能规范；代码变化时同步更新相关 Spec，也可以单独为已有项目补充文档。

## 初始化

需要 Node.js 20 或以上。在本仓库目录注册命令：

```bash
npm link
```

然后进入需要维护 Spec 的目标项目：

```bash
cd /path/to/your-project
postspec init --agents codex
```

运行 `postspec init` 可交互选择 Agent；也可以通过逗号分隔同时指定多个：

```bash
postspec init --agents codex,claude,cursor,gemini
```

| Agent | Skill 路径 |
| --- | --- |
| Codex | `.agents/skills/postspec/SKILL.md` |
| Claude Code | `.claude/skills/postspec/SKILL.md` |
| Cursor | `.cursor/skills/postspec/SKILL.md` |
| Gemini CLI | `.gemini/skills/postspec/SKILL.md` |

初始化会生成 Skill、Spec 模板和以下基础目录及配置。具体 Spec 由 Agent 创建：

```text
openspec/
├── config.yaml
└── specs/
    └── <capability>/
        └── spec.md
```

## 使用

在目标项目中直接与 Agent 对话：

```text
使用 postspec，为现有登录功能建立 spec。
```

```text
使用 postspec，为 Passkey 登录建立 spec。
```

```text
使用 postspec，根据最新代码和测试同步现有 spec。
```

```text
我修改了登录 spec，请结合我的修改和当前代码补充边界条件。
```

Agent 会自动判断受影响的能力：新能力建立 Spec，已有能力直接做语义更新。Spec 记录当前行为、约束、不变量和有长期价值的决策，按能力组织文档。更新前读取磁盘上的最新内容，保留无关人工修改；未实现的功能不会写成已实现的事实。

全部规范直接写入 `openspec/specs/`。初始化安装的是 Agent 指令，不是后台文件监听器；自动维护发生在 Agent 执行相关任务时。

## 校验与更新

Codex 的生成结构可本地校验：

```bash
postspec validate
```

该命令检查目录、Skill 元数据和模板引用，不验证 Spec 内容或 Agent 的实际行为。其他 Agent 目前仅生成兼容目录，尚未验证行为一致性。

重复初始化默认保留已有文件。刷新 Skill 时执行：

```bash
postspec init --agents codex --force
```

`--force` 会刷新所选 Agent 的 Skill 和模板。已有 `openspec/config.yaml`、Spec 和其他用户文件保留。

## 开发校验

```bash
npm test
npm run lint
```
