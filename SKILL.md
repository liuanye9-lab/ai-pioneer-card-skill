---
name: "ai-pioneer-feishu-card"
description: "把一段原始活动文案编译成事实可信、手机优先、可直接发送的飞书卡片（Card JSON 2.0），并附群运营话术与 QA 报告。用户发来活动通知/时间线/培训预告/作品提交/截止提醒/案例/报名/结果公布/奖项/倒计时/操作指南等需要发飞书群的文案，或明确说“做张卡片/出张卡/发群卡片”时使用。事实不改（活动名/日期/时间/截止/URL/人名/数字/奖项/规则原样保留；0809/8.9→8月9日；📣不写成【喇叭】），无真实链接绝不编造，关键事实落原生文字或按钮，发送前须确认。不做长文/周报/纯做图/开放问答/建日程/改多维表——越界转对应助手。"
description_zh: "把一段原始活动文案编译成事实可信、手机优先、可直接发送的飞书卡片（Card JSON 2.0），并附群运营话术与 QA 报告。触发：活动通知/时间线/培训/作品提交/截止提醒/案例/报名/结果/奖项/倒计时/指南等飞书群卡片需求。硬规则：事实不改、无链接不编造、关键事实进原生文字或按钮、发送前确认。越界（长文/周报/纯做图/问答/建日程/改多维表）转对应助手。"
version: "3.0"
user-invocable: true
---

# SKILL — AI先锋大赛智能飞书卡片

**Version**: v3.0（可执行 CardKit 草稿链路）
**Skill Name**: `ai-pioneer-feishu-card`
**结构**: 触发层 → 执行层 → 兜底层 → 参考层（固定顺序：发现 → 完成 → 处理异常 → 补充资料）

> 本文件是「索引层：命中 + 内容层：执行」。历史全量规范（含 Mobile First 细则）见 [PRD.md](./PRD.md) / [SPEC.md](./SPEC.md) / [DESIGN.md](./DESIGN.md)（参考层，按需加载）。企业级框架自查见 [ENTERPRISE-AUDIT.md](./ENTERPRISE-AUDIT.md)。

---

# A. 触发层（索引层 · 命中）

## Name
AI先锋大赛智能飞书卡片（`ai-pioneer-feishu-card`）

## Description
把一段原始活动文案，编译成事实可信、手机优先、信息清晰、可编辑可发送的飞书卡片（Card JSON 2.0），并附带群运营话术与 QA 报告。

## 适用场景
活动通知 / 时间线赛程 / 培训预告 / 作品提交 / 截止提醒 / 案例展示 / 报名 / 结果公布 / 奖项 / 倒计时 / 操作指南 —— 需要在飞书群里发的活动卡片。

## 不适用场景
- 长文 / 公众号文章 / 周报 / 方案正文写作
- 纯图片 / 海报 / logo 生成（无卡片承接）
- 开放问答 / 知识解释
- 建日程/会议、多维表数据增改

## 相邻 Skill 边界
| 需求 | 该转 |
|---|---|
| 写长文/文档 | 文档写作 Skill |
| 只要图片 | 图片生成 Skill |
| 问答/解释 | 问答 / 知识 Skill |
| 建日程/会议 | 日历 Skill |
| 改多维表数据 | 多维表 Skill |

本 Skill 只负责「把活动信息编译成卡片」；卡片里的按钮可跳转到上述系统，但不代它们执行。

## 触发条件
输入包含活动/通知/时间/行动信号（活动名、日期、截止、提交、报名、培训、名单、案例…），或用户明确说“做张卡片”。

写法要点：短、准、边界清楚。

---

# B. 执行层（内容层 · 执行）

## 输入要求
- `copy`（必填）：原始文案，唯一事实源。
- `brand`（可选）：品牌名，复用 `brands/<slug>/style.md`。
- `knownLinks`（可选）：已知真实 URL，绝不编造。

## 执行步骤（22 步管线，`src/core/pipeline.ts`）
```
Parse → Source of Truth → Fact Lock → Normalize(日期/Emoji) → Semantic Dedup
→ Card Intent → Render Mode → Image Intent →〔兜底层 preflight 守门〕
→ Attention → Information Architecture → Brand/Style → Image Plan → CTA Plan
→ MOBILE LAYOUT PASS → MOBILE IMAGE READABILITY → MOBILE CTA
→ Desktop Enhancement → Card JSON Render → Operation Copy
→ QA(Fact→Information→Image→Navigation→Brand→Feishu→Mobile→Cross-device)
→ Rewrite if score<85 or hardFail (≤2) → Output Bundle
```

## 关键参数
- Intent 枚举 13 类；confidence<0.65 → fallback announcement。
- Render Mode：text_first / image_assisted / image_led_navigation。
- 注意力：Primary Anchor=1，Secondary≤3；CTA：Primary≤1，Secondary≤4。
- 手机：默认单列；Primary CTA 独占；短标签≤2 并排，否则纵向；禁 3+ 一排。

## 工具调用逻辑
- 默认一键制卡：`create_cardkit_draft`（文案→信息分层→模板/品牌→生图→上传→QA→CardKit `card_id`）。
- 宿主生图：首次返回 `needs_image` 时，必须用 `delegate_prompt` / `delegate_size` 调宿主生图，再携 `generated_image_url` 二次调用；禁止跳过图片后冒充完成。
- 仅预览：`generate_feishu_card`（纯离线；`with_image=true` 时可接运行时图像端点）。
- 自定义编辑后保存：`update_cardkit_card`（按 `card_id` 更新 CardKit 实体）。
- 校验：`validate_feishu_card`（Card JSON 2.0 结构校验）。
- 发送：`send_feishu_card`（对外动作，需 confirm；无凭证停在 Generated）。
- 回调：`scripts/callback-server.ts`（POST /api/feishu/card/callback）。

> 运行边界：仅安装本 Markdown Skill 不会执行仓库 TypeScript。要获得真实图片、`img_key` 和 `card_id`，宿主必须注册 `agent/tools.schema.json` 中的工具并连接可访问的 `scripts/tool-server.ts`。否则只能输出预览，不得声称已创建 CardKit 卡片。

## 输出格式
`outputs/{slug}/`：source_of_truth.json / intent.json / render_plan.json / mobile_layout.json / style.md / card_content.md / card.json / card.preview.json / operation_copy.md / qa_report.json / cross_device_qa.json / **preflight.json** / publish_status.json / assets/。

## 质量标准
六维评分 ≥85 才 pass（Information 30 / Attention 20 / Action 15 / Brand 15 / Visual 10 / Feishu 10）；任一 hard-fail 直接 Fail；Mobile Fail = Final Fail。

写法要点：流程稳定、结构固定。

---

# C. 兜底层（异常可控 · `src/core/preflight.ts`）

在执行渲染前守门，异常处理独立于执行逻辑：

| 场景 | 行为 |
|---|---|
| 缺参数追问 | 缺提交/报名 URL → 非阻断追问（仍出卡，按钮省略，绝不编链接） |
| 输入不足追问 | 文案过短且无事实 → 阻断，追问“什么活动/时间/要用户做什么” |
| 工具失败降级 | 图片不可用/过密 → image_led→image_assisted→text_first，关键事实转原生文字 |
| 依赖失败处理 | 飞书凭证缺失→离线 Generated；品牌未缓存→默认视觉 |
| 低置信标注 | intent.confidence<0.65 / 未识别活动名 / uncertain_information → 如实标注请人工确认 |
| 越界拒绝/转其他 Skill | 非卡片任务 → 拒绝并给 `suggested_skill`，不硬做 |
| 风险确认 | 真实发送（对外动作）→ 必须显式 confirm |

输出：`preflight.json` + 结果对象 `preflight` 段（status: ok / needs_clarification / out_of_scope）。

写法要点：异常可控。

---

# D. 参考层（只挂载 · 按需加载 · 不触发不加载）

| 资源 | 位置 | 何时加载 |
|---|---|---|
| Template（布局策略） | `templates/` + `src/renderer/template-registry.ts` | 选模板时 |
| Schema | `schemas/*.json`（source-of-truth / card-intent / style） | 需要校验/对接时 |
| 示例 | `examples/`（7 个完整 bundle） | 需要参考产物时 |
| 术语表 / 业务规则 / 行业规范 | PRD.md / DESIGN.md | 争议或细节裁决时 |
| 长文档 | PRD.md / SPEC.md（Mobile First 全量细则） | 深挖某规则时 |
| 品牌资料 | `brands/<slug>/`（style.md / research.json / assets.json） | 指定品牌时 |

原则：只挂载、按需加载、能不触发就不触发。

---

# E. 固定顺序与适配

- 固定顺序：触发 → 执行 → 兜底 → 参考；对应链路 发现 → 完成 → 处理异常 → 补充资料。
- 适配：本 Skill 属「重业务 + 高风险（对外群发）+ 高规范」象限，故四层写全、兜底写细；轻任务（纯 deadline）不加载图片/导航参考。
- 检查清单（详见 ENTERPRISE-AUDIT.md）：能否被发现 ✅ / 能否稳定执行 ✅ / 异常是否可控 ✅ / 参考是否按需加载 ✅ / 边界是否清晰 ✅ / 成本是否可接受 ✅。

---

# F. 硬规则（不可违反）
1. 不编造：活动名/日期/时间/截止/URL/人名/数字/奖项/规则。
2. `AI先锋大赛` ≠ `先锋大赛`；`📣` ≠ `【喇叭】`；`0809/8.9 → 8月9日`。
3. 关键事实（截止/日期/入口 URL）必须在原生文字或 CTA 承接，不能只在图片。
4. 发送是对外动作，需显式确认；未真实测试不得声称“已打通飞书”。
5. Secret 仅从环境读取，绝不写入卡片/日志/回复。
6. 创建 CardKit 草稿不等于已发送；`card_id` 表示可通过 API 继续更新，不得虚构 CardKit 可视化编辑器链接。卡片实体有效期 14 天且仅可发送一次。
