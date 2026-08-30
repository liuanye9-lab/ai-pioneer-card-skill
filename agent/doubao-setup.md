# 在豆包创建「飞书活动卡片」工作伙伴 — 照着填

对应你截图里的弹窗「想要 工作伙伴 帮你的团队做什么？」。下面每一步都能直接抄。

---

## 第 0 步：入口
豆包工作台 → 伙伴·小队 → 右上「＋创建」（或“创建新伙伴”）→ 选「**团队使用**」。

---

## 第 1 步：把这段粘进大输入框（"想要工作伙伴帮你的团队做什么？"）

```
我想要一位「飞书活动卡片助手」。团队里做活动运营/CSM 的同学，会把一段乱糟糟的活动文案发给你，你要把它变成一张可以直接发飞书群的卡片：
1) 事实不许改（活动名、日期、时间、截止、链接、人名、数字、奖项、规则原样保留；0809/8.9 统一成 8月9日；📣 不许写成【喇叭】）；
2) 手机优先：默认单列、第一眼就看到最重要的信息、按钮大而清楚、不横滑不放大；
3) 判断这是哪类卡（时间线/截止/培训/提交/案例/通知/报名/结果/奖项…）再排版，别直接套模板；
4) 没有真实链接就不要编造，按钮宁可省略；关键截止/入口必须落在原生文字或按钮里，不能只画在图片上；
5) 每张卡额外给我发卡前/发卡时/发卡后的群运营话术，口语、简短、不要公众号腔；
6) 不属于卡片的活儿（写长文、纯做图、纯问答、建日程、改多维表）就直说并建议我换对应助手，别硬做；
7) 真实发送前必须先跟我确认接收群和内容，我没确认就只生成不发送。
```

> 说明：这段就是智能体人设的浓缩版。完整版见 [system-prompt.md](./system-prompt.md)，创建后可粘到「人设/Prompt」高级设置里覆盖。

---

## 第 2 步：将工作伙伴加入到群组
选你的活动运营群（如「AI先锋大赛运营群」）。没有就先建一个测试群。

## 第 3 步：主动工作
- **开**：希望它盯着群里的截止/提交进度，主动提醒（推荐运营场景开）。
- 关：只想手动喊它出卡时再关。

## 第 4 步：向群内推送每日回顾
- **开 + 时间设为你们的收工点**（截图是 20:55；建议贴近 deadline 提醒节奏，如 18:00）。
- 回顾会带上「今天还没交作品的人数 / 临近的截止节点」这类提醒。

## 第 5 步：点「创建」。

---

## 第 6 步（关键）：把飞书卡片 Skill 嵌进去

有两种嵌法，按你平台开通的能力二选一：

### 方式 A：Prompt 内嵌（仅规则预览，不能复现完整效果）
创建后进入伙伴「编辑 / 高级设置 / 人设」，把 [system-prompt.md](./system-prompt.md) 全文贴进去覆盖默认人设。
此方式只注入规则，**不会执行仓库 TypeScript，也不会真实生图、上传图片或创建 CardKit 实体**。它只能用于验证触发和回复风格，效果必然弱于本地完整管线。

### 方式 B：工具/插件内嵌（生产必选）
如果你的豆包工作伙伴支持「插件 / 工具 / 自定义 API（函数调用）」：
1. 在「工具/插件」里按 [tools.schema.json](./tools.schema.json) 注册 5 个函数：
   - `create_cardkit_draft`（默认：文案→生图→上传→CardKit `card_id`）
   - `update_cardkit_card`（自定义编辑后更新卡片实体）
   - `generate_feishu_card`（仅预览：Card JSON + 摘要 + 运营话术）
   - `validate_feishu_card`（离线结构校验）
   - `send_feishu_card`（真实发送，需 confirm）
2. 后端把函数调用转发到本项目：`dispatchTool(name, args)`（见 `src/agent/tool-adapter.ts`）。
   最小服务示例见 [tool-server.ts](../scripts/tool-server.ts)（`npx tsx scripts/tool-server.ts`，POST /tool）。
3. 配置 `.env`：
   - `IMAGE_API_URL` / `IMAGE_API_KEY`：服务端直接调用生图模型；未配置时由豆包宿主按 `delegate_prompt` 生图并二次回传 URL。
   - `FEISHU_APP_ID` / `FEISHU_APP_SECRET`：上传图片、创建/更新 CardKit 与发送。
4. `create_cardkit_draft` 只创建可通过 API 更新的卡片实体，不会发群；`send_feishu_card` 才是对外发送，仍需确认。

> 如果当前豆包工作伙伴没有“自定义 API/函数工具”入口，命名 Skill 无法单独完成这条链路。需要先把 `tool-server.ts` 部署为豆包可访问的 HTTPS 服务，再接入工具；不要把 Prompt-only 结果当作生产效果。

---

## 第 7 步：先本地看效果（不接平台也能验证）
```bash
npm run agent:chat           # ★ 直接和这个 Agent 对话（终端多轮，最接近平台体验）
npm run agent:conversation   # 脚本化多轮对话演示
npm run agent:demo           # 工具调用回合演示
```

---

## 建议填写速查
| 字段 | 建议 |
|---|---|
| 使用方式 | 团队使用 |
| 描述框 | 第 1 步整段 |
| 加入群组 | 你的活动运营群 |
| 主动工作 | 开 |
| 每日回顾 | 开，时间贴近截止提醒节奏 |
| 头像 prompt | `minimal iOS-style app icon, soft blue-to-white gradient, a clean card with a checkmark, premium, low saturation, no text` |
| 开场白 | 见 [agent.manifest.json](./agent.manifest.json) `opening_remark` |
| 预设问题 | 见 manifest `preset_questions`（3 条可直接用） |
