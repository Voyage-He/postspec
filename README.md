# PostSpec

PostSpec 是一个类似 OpenSpec、但刻意减少流程约束的 AI 开发 SDD 工作流。CLI 仅用于初始化项目级 Agent Skill；初始化后，proposal、实现和 spec 都通过与 AI Agent 对话完成。

## 初始化

```bash
npm link
postspec init
```

`postspec init` 会交互选择需要适配的 Agent：

```text
选择需要生成 PostSpec skill 的 Agent：
  1. Codex
  2. Claude Code
  3. Cursor
  4. Gemini CLI
可多选，例如 1,2；输入 all 选择全部。
```

也可在非交互环境直接指定：

```bash
postspec init --agents codex,claude
```

生成的项目级 Skill：

| Agent | Skill 路径 |
| --- | --- |
| Codex | `.agents/skills/postspec/SKILL.md` |
| Claude Code | `.claude/skills/postspec/SKILL.md` |
| Cursor | `.cursor/skills/postspec/SKILL.md` |
| Gemini CLI | `.gemini/skills/postspec/SKILL.md` |

Codex 是当前已完成真实行为验证的目标；其他 Agent 目前仅生成兼容目录，尚未承诺行为一致性。

PostSpec 工作文件由 Agent 在执行 Skill 时创建：

```text
postspec/
├── config.yaml
├── changes/<change-name>/
│   ├── proposal.md
│   ├── discuss.md
│   └── specs/
│       └── <capability>.md
├── specs/<capability>.md
└── archive/<change-name>/
```

## 使用

初始化后直接与 Agent 对话：

```text
使用 postspec 帮我增加 Passkey 登录。
```

Agent 会驱动三个阶段：

1. **Proposal**：多轮讨论需求、范围、非目标和技术方向；人类确认后在 proposal 中标记 `Status: approved`。
2. **Implementation**：直接实现并持续测试、讨论和更新，不创建 plan/tasks；仅在 `discuss.md` 中记录影响实现或最终 Spec 的核心讨论。
3. **Spec**：LLM 按受影响的模块或能力分别判断是否值得固化，一个 change 可以产生零个、一个或多个候选 Spec。AI 自主完成候选拆分、必要性判断、新建或语义合并主 Spec，不在写入前等待人工批准，但此时不会归档 change。

用户声明实现完成时，Agent 仍需以最终代码、测试和 `discuss.md` 交叉验证。缺失或仍阻塞的实现不能进入 Spec 或完成归档；明确取消的 change 会在 proposal 中标记 `Status: cancelled` 后归档。

Spec 完成后，active change 保留在 `postspec/changes/`。change 内通过必要性判断的 Spec 会作为非空历史快照保留，同时复制或语义合并到 `postspec/specs/`，不会因主 Spec 固化而被移动、删除或清空。人工通过内部或外部编辑器自行审核和修改；需要进一步调整时，直接在对话中告诉 AI，AI 会先读取人工编辑后的当前 Spec，再结合最终代码、测试和 change 上下文进行局部语义更新，不覆盖无关人工修改，并同步对应的 change Spec 快照。只有人工明确确认“审核完成，可以归档”后，AI 才会先检查 change Spec 快照完整性，再把包含 `specs/` 的整个 change 移入 `postspec/archive/`。即使 AI 判断无需生成 Spec，也必须等待人工审核该判断后再归档。

Codex Skill 同时包含稳定的 proposal、discuss、spec 模板和 `agents/openai.yaml`。初始化后可执行本地校验：

```bash
postspec validate
```

再次运行 `postspec init` 不会覆盖已有 Skill。需要更新生成内容时使用：

```bash
postspec init --agents codex --force
```
