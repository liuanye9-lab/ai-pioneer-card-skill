# AI先锋大赛智能飞书卡片 Skill

> 把一段乱糟糟的活动文案，稳定编译为 **事实可信 + 手机优先 + 信息清晰 + 品牌统一 + 图片真正传递信息 + 按钮直接完成行动 + 可编辑 Feishu Card + 运营话术 + QA 报告**。

这不是一个卡片模板生成器。它是：

**AI Card Design System + Content Compiler + Mobile-first Information Architecture + Feishu Runtime + Operation Copilot**

对应文档：[PRD.md](./PRD.md) · [SPEC.md](./SPEC.md) · [DESIGN.md](./DESIGN.md) · [SKILL.md](./SKILL.md) · [MOBILE-FIRST-CHANGELOG.md](./MOBILE-FIRST-CHANGELOG.md)

企业级自查：[ENTERPRISE-AUDIT.md](./ENTERPRISE-AUDIT.md) · 智能体封装：[agent/](./agent)

---

## 企业级四层结构（对齐「企业级 Skill 怎么写」）

| 层 | 内容 | 落点 |
|---|---|---|
| 触发层（命中） | Name/Description/适用/不适用/相邻边界/触发条件 | [SKILL.md](./SKILL.md) A |
| 执行层（执行） | 输入/22 步管线/关键参数/工具/输出/质量标准 | [SKILL.md](./SKILL.md) B · `src/core/pipeline.ts` |
| 兜底层（异常可控） | 缺参追问/输入不足/工具降级/依赖失败/低置信标注/越界拒绝转 Skill/风险确认 | `src/core/preflight.ts` → `preflight.json` |
| 参考层（按需加载） | Template/Schema/示例/术语/业务规则/长文档 | `templates/ schemas/ examples/ brands/` |

固定顺序：触发 → 执行 → 兜底 → 参考（发现 → 完成 → 处理异常 → 补充资料）。

---

## 豆包工作伙伴智能体

本 Skill 已封装为豆包工作伙伴智能体「飞书活动卡片助手」，Skill 作为其核心工具嵌入。详见 [agent/](./agent)。

在豆包工作伙伴中可通过两种方式使用：

- 直接与「飞书活动卡片助手」对话并粘贴活动原文。
- 在对话中显式输入 `/ai-pioneer-feishu-card` 调用命名 Skill。

命名 Skill 只提供指令，不会自动执行本仓库代码。要得到真实图片、`img_key` 和 CardKit `card_id`，必须把工具服务接入豆包的函数调用能力；Prompt-only 模式只能用于预览。

从 GitHub 安装：市场 → 技能 → ＋新建 → 通过 URL 创建，填写：

```text
https://github.com/liuanye9-lab/ai-pioneer-card-skill
```

```bash
npm run agent:chat           # ★ 直接对话这个 Agent（终端多轮：出卡/追问/越界/确认发送）
npm run agent:conversation   # 脚本化多轮对话演示
npm run agent:demo           # 工具调用回合演示
npm run agent:server         # HTTP 工具服务，供豆包平台函数调用转发
```

五个工具：`create_cardkit_draft`（生产入口）· `update_cardkit_card` · `generate_feishu_card`（预览）· `validate_feishu_card` · `send_feishu_card`（需 confirm）。
接入方式见 [agent/README.md](./agent/README.md)：填 [system-prompt.md](./agent/system-prompt.md)、注册 [tools.schema.json](./agent/tools.schema.json)、后端用 `dispatchTool()` 承接。

---

## 快速开始

```bash
npm install
npm run build          # 编译到 dist/
npm test               # 运行全部单测 + Golden + Mobile Golden

# 直接从一段文案生成完整 bundle（离线，无需飞书凭证）
npm run gen -- --copy "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com 📣 记得不要错过"

# 指定品牌（复用 brands/xiangshanghui/style.md）
npm run gen -- --copy "象上汇先锋大赛决赛名单公布，9月10日路演，名单：https://example.com/finalists" --brand 象上汇

# 生成 7 个示例 bundle 到 examples/
npm run examples
```

输出目录（`outputs/{slug}/`）包含：

```
source_of_truth.json     事实源（可追溯 source_text）
intent.json              intent + render_mode + image_intent + attention
render_plan.json         模板 / 设备档 / 阅读顺序 / CTA 概要
mobile_layout.json       Mobile Layout Pass 结果（必存在）
style.md                 使用的视觉规范
card_content.md          人类可编辑的卡片内容
card.json                Feishu Card JSON 2.0（可直接编辑）
card.preview.json        手机阅读顺序的可读预览
operation_copy.md        发卡前/时/后 + Deadline Reminder
qa_report.json           六维评分 + 全部 QA 结果
cross_device_qa.json     mobile / ios / android / desktop
publish_status.json      Generated/Configured/Tested + 权限清单
assets/image_prompt.md   （若需要图片）图片规划与 Prompt
```

---

## 第一性原理

```
事实准确
> 手机端信息传达效率
> 行动效率
> 信息层级
> 跨端一致性
> 品牌一致性
> 美观
```

任何代码/设计/视觉与此冲突时，优先第一层。

---

## 流水线（SKILL §39 强制顺序）

```
Parse → Source of Truth → Fact Lock → Normalize(日期/Emoji) → Semantic Dedup
→ Card Intent → Render Mode → Image Intent → Attention → Information Architecture
→ Brand/Style → Image Plan → CTA Plan
→ MOBILE LAYOUT PASS → MOBILE IMAGE READABILITY → MOBILE CTA
→ Desktop Enhancement → Card JSON Render → Operation Copy
→ QA(Fact→Information→Image→Navigation→Brand→Feishu→Mobile→Cross-device)
→ Rewrite if score<85 or hardFail (≤2 次) → Output Bundle
```

模块边界见 [src/](./src)：`parser/ normalize/ dedup/ intent/ brand/ design/ mobile/ renderer/ feishu/ operation/ qa/ output/`。

---

## 事实安全（Hard Gate）

原始文案是唯一事实源。禁止 AI 擅自修改：活动名 / 企业名 / 人名 / 日期 / 时间 / 截止 / 地点 / URL / 数字 / 奖项 / 规则 / 提交要求。

允许在明确日期语境中做语义等价标准化：`0809 / 8.9 / 08/09 / 8-9 → 8月9日`，`8.9-8.15 → 8月9日—8月15日`。

非日期数字必须原样保留：`8.9万元`、`第8.15条`、`会议室0809`、`版本8.9`、`9.9折`、`售价8.9-8.15元` 均不得转换为日期。

- **Emoji 保真**：`📣` 永不变成 `【喇叭】`。
- **无 URL 不造链接**：没有真实 URL 时，删除按钮而不是编造。
- **裸链接不进正文**：URL 只由按钮承载，不与奖品、证书或运营文案挤在同一段。
- **关键事实不只在图片里**：Deadline / 精确日期 / 提交入口 / URL / 高风险规则必须同时在原生文字或 CTA 中承接。

---

## 信息呈现策略

卡片首先解决信息传达，而不是装饰：

- 先识别一个 Primary Anchor；截止、开始、当前节点等关键事实优先展示并高亮。
- 禁止文字墙：单块正文超过阈值会触发 QA，并进入拆分或降级流程。
- 奖品、证书、时间、入口等不同语义分开承载，不拼成长段。
- Emoji 只在日期、提醒、奖项等关键块中适度出现，不强制每段添加。
- 内容更适合视觉表达时，优先使用信息图或 Hero 图承载概括；精确事实仍保留为原生文字。
- URL、报名、提交、规则、日历、会议等行动信息优先转换为按钮；多个真实链接可生成多个跳转按钮。

推荐结构：**少量关键文字 + 信息图 + 明确按钮**。仅预览流程在图片失败时回退为可读文字卡；`create_cardkit_draft` 默认严格模式，已规划图片但未成功生成/上传时停止创建，避免低质量草稿冒充成品。

---

## Mobile First

手机端是基线，不是兼容项。默认单列、纵向阅读；Primary CTA 独占一行；Secondary 短文案最多 2 个并排，否则纵向；3 个以上按钮禁止一排。信息图缩到手机宽度需放大即判失败 → 减字/减模块/拆图/关键事实转原生文字。`Mobile Fail = Final Fail`。

---

## 飞书运行时（Generated / Configured / Tested）

| 状态 | 含义 |
|---|---|
| **Generated** | JSON/代码已生成（离线始终可用） |
| **Configured** | 已配置 `FEISHU_APP_ID`/`FEISHU_APP_SECRET` 等凭证 |
| **Tested** | 真实飞书环境发送/更新/回调成功 |

**当前状态：Generated。** 未配置真实凭证前，绝不声称“已打通飞书”。

配置凭证：复制 [.env.example](./.env.example) 为 `.env` 并填写。切勿提交 `.env`。

```bash
# 真实发送（需凭证 + chat_id）
npm run gen -- --copy "..." --send --chat oc_xxxxx

# 走本机 lark-cli 发送（需已 lark-cli auth login，无需应用凭证）
npm run gen -- --copy "..." --send-cli --chat oc_xxxxx --confirm

# 一键生图并通过 lark-cli 创建 CardKit 草稿（不发群）
npm run gen -- --copy "..." --cardkit-draft --transport lark_cli

# delegate 模式拿到宿主生图 URL 后继续
npm run gen -- --copy "..." --cardkit-draft --transport lark_cli \
  --image-url "https://example.com/generated.png"

# 上传本地图片并渲染为卡片原生 img 元素（需凭证换取 img_key）
npm run gen -- --copy "..." --hero-image assets/hero.png

# 卡片回调服务（POST /api/feishu/card/callback）
npx tsx scripts/callback-server.ts
```

两条发送通道共用同一套安全门禁：hard-fail 的卡禁止发送；对外发送必须显式 `--confirm`。
图片链路：`--hero-image` → `FeishuCardAdapter.uploadImage()` 换取 img_key → 渲染原生 img 元素；
无凭证/上传失败时自动降级为原生文字承载（绝不伪造 img_key）。

Feishu Card Adapter 接口（[src/feishu/cardkit-client.ts](./src/feishu/cardkit-client.ts)）：`createCard()` / `sendCard()` / `updateCard()` / `uploadImage()` / `validateCard()`。回调覆盖：签名校验、幂等（重复点击）、过期、无效负载、权限/API/网络错误。

> Card JSON 2.0 字段依据飞书开放平台官方文档核对（2026-08）。发布前请再次核对最新 Schema 与客户端兼容范围。

### 一键生图与 CardKit 草稿

生产入口是 `create_cardkit_draft`：文案 → 事实/注意力排序 → 模板/品牌 → 生图 → 飞书图片上传 → QA → CardKit 实体。成功返回 `card_id`，后续可用 `update_cardkit_card` 更新；同一实体的 `sequence` 必须从 1 开始严格递增。创建实体不等于发群，也不会虚构 CardKit 可视化编辑器链接。按飞书官方约束，卡片实体有效期为 14 天且仅可发送一次。

`generate_feishu_card` 仍用于离线预览；它支持 `with_image` 选项。`create_cardkit_draft` 默认要求已规划的图片真实落地。

| 环境变量 | 作用 |
|---|---|
| `IMAGE_API_URL` / `IMAGE_PROVIDER_BASE_URL` | 设置任一项后进入 **runtime 模式**：直接调用该文生图端点生成图片 |
| `IMAGE_API_KEY` / `IMAGE_PROVIDER_API_KEY` | 可选，作为上面端点的 Bearer 鉴权 |
| `IMAGE_GEN_DISABLED=1` | 关闭图片生成 |

- **runtime 模式**：配置了任一图片端点变量时，Skill 直接请求该端点得到图片（URL 或二进制）。
- **delegate 模式**：未配置端点时，返回 `needs_image`、Prompt 与尺寸；宿主生图后把 HTTPS URL 作为 `generated_image_url` 二次调用同一工具。
- 生成的图片要变成卡片可用的 `img_key`，仍需飞书凭证上传（`uploadImageBytes` / `uploadImageFromUrl` → `im/v1/images`）。
- 本机可用 `transport=lark_cli`，通过已登录的飞书 CLI 上传图片并调用 CardKit；服务端推荐 `transport=open_api`。

仅安装 `SKILL.md` 不会执行这些代码。豆包伙伴必须注册 [agent/tools.schema.json](./agent/tools.schema.json) 并连接可访问的工具服务，否则只能得到 Prompt 级预览，无法达到本地完整链路效果。

---

## 脚本

| 命令 | 说明 |
|---|---|
| `npm run build` | tsc 编译到 `dist/` |
| `npm run typecheck` | 仅类型检查 |
| `npm run lint` | ESLint |
| `npm test` | Vitest（116 用例） |
| `npm run gen -- --copy "..."` | 生成单个卡片 bundle |
| `npm run examples` | 生成 7 个示例 bundle |

---

## 目录

```
ai-pioneer-card-skill/
├── README.md SKILL.md PRD.md SPEC.md DESIGN.md MOBILE-FIRST-CHANGELOG.md
├── package.json tsconfig.json vitest.config.ts .eslintrc.cjs
├── .env.example .gitignore
├── prompts/      各阶段 Agent 提示词
├── schemas/      JSON Schema（source-of-truth / card-intent / style）
├── brands/       品牌缓存（xiangshanghui/）
├── templates/    模板策略说明
├── scripts/      generate-examples / callback-server
├── src/          核心实现（见上）
├── tests/        单测 + Golden + Mobile Golden
├── examples/     7 个完整示例 bundle
└── outputs/      运行产物
```
