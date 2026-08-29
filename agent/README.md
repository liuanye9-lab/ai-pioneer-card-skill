# 豆包工作伙伴 · 飞书活动卡片助手（Agent）

把「AI先锋大赛智能飞书卡片 Skill」封装成一个豆包工作伙伴智能体，Skill 作为智能体的核心工具嵌入。

## 组成
| 文件 | 作用 |
|---|---|
| [doubao-setup.md](./doubao-setup.md) | **照着填**：在豆包创建工作伙伴弹窗里逐字段怎么配 + 两种嵌入方式 |
| [agent.manifest.json](./agent.manifest.json) | 智能体清单：身份、开场白、预设问题、能力、护栏、内嵌 Skill 声明 |
| [system-prompt.md](./system-prompt.md) | 智能体人设与操作规则（固定顺序：发现→完成→处理异常→补充资料） |
| [tools.schema.json](./tools.schema.json) | Function-calling 工具声明（generate/validate/send） |
| `../src/agent/agent-runtime.ts` | **可对话的 Agent 运行时**：会话状态 + 工具调用循环 + 人设回复 + 发送确认 |
| `../src/agent/tool-adapter.ts` | 运行时桥：把工具调用接到编译管线 |
| `../scripts/tool-server.ts` | 最小 HTTP 工具服务（POST /tool），供平台函数调用转发 |

## 三个工具（嵌入的 Skill 能力）
1. **generate_feishu_card**（核心）— 文案 → 事实可信、手机优先的 Card JSON 2.0 + 摘要 + 兜底信号。
2. **validate_feishu_card** — 离线结构校验。
3. **send_feishu_card** — 真实发送，必须 `confirm=true`；无凭证时停在 Generated。

## 智能体如何用 Skill（对齐企业级四层）
- **触发层**：manifest 的能力/场景 + system-prompt 的“能做/不做”，让智能体被正确命中、越界即转其他 Skill。
- **执行层**：`generate_feishu_card` 调 22 步编译管线（事实锁定→标准化→去重→意图→手机布局→QA）。
- **兜底层**：适配器透传 `preflight` 的越界拒绝 / 缺参追问 / 低置信标注 / 风险确认，智能体如实转述而非硬编。
- **参考层**：PRD/SPEC/DESIGN/schemas/brands/templates 按需加载，不触发不加载。

## 本地体验（无需 LLM）
```bash
npm run agent:chat           # ★ 真实可对话的 Agent（终端多轮：出卡/追问/越界/确认发送）
npm run agent:conversation   # 脚本化多轮对话演示（固定剧本）
npm run agent:demo           # 工具调用回合：正常 / 越界 / 缺参 / 风险确认 / 拒发
npm run agent:server         # 起 HTTP 工具服务 (POST /tool)，供豆包函数调用转发
```

`agent:chat` 就是把 Skill 嵌进去后**能直接对话的智能体**：输入文案→出卡+运营话术；说“发到群里”→确认后发送（无凭证则如实停在 Generated）；越界会转其他 Skill。运行时逻辑在 `src/agent/agent-runtime.ts`（确定性路由，可整体替换为真实 LLM）。

## 在豆包平台创建（照着填）
完整逐字段说明见 [doubao-setup.md](./doubao-setup.md)。摘要：
1. 伙伴·小队 → ＋创建 → 团队使用；描述框粘 setup 文档第 1 步整段。
2. 加入你的活动运营群；主动工作=开；每日回顾=开（时间贴近截止提醒）。
3. 嵌入 Skill：
   - **方式 A（零依赖）**：把 [system-prompt.md](./system-prompt.md) 贴进「人设/Prompt」。
   - **方式 B（可校验/可真发）**：按 [tools.schema.json](./tools.schema.json) 注册 3 个函数，后端用 `dispatchTool()` 或起 `scripts/tool-server.ts` 承接。
4. 配 `.env`（FEISHU_APP_ID/SECRET…）后，`send_feishu_card` 才会从 Generated 进入真实发送。
