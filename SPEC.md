# AI先锋大赛智能飞书卡片 Skill — SPEC

**版本**：v1.2  
**状态**：Ready for Implementation  
**对应 PRD**：PRD v1.1 图片增强版  
**技术目标**：将非结构化活动文案稳定编译为事实可信、信息层级清晰、视觉统一、支持图片承载信息、可在飞书中交互与继续编辑的 CardKit / Card JSON 2.0 产物。

---

# 1. 技术目标

系统必须完成以下链路：

```text
Raw Copy
→ Fact Extraction
→ Fact Lock
→ Normalize
→ Deduplicate
→ Intent Classification
→ Render Mode Classification
→ Brand / Style Resolution
→ Information Architecture
→ Image Planning
→ CTA / Interaction Planning
→ Card JSON Render
→ Operation Copy
→ QA
→ Output Bundle
```

核心约束：

1. **事实不可漂移**
2. **卡片意图先于模板**
3. **图片可作为信息承载层**
4. **按钮承担行动路径**
5. **输出必须可编辑**
6. **生成、配置、测试三种状态必须分离**
7. **所有飞书 Schema 以运行时最新官方能力为准**

---

# 2. 推荐技术栈

默认实现建议：

```text
Runtime: Node.js 20+
Language: TypeScript
Validation: Zod / JSON Schema
HTTP: fetch / axios
Feishu SDK: 优先官方 Node SDK；没有则 REST OpenAPI
Template: JSON builder
Testing: Vitest / Jest
Env: dotenv
Optional Image Generation: external image provider adapter
```

允许 Python 实现，但接口、Schema 与目录结构保持一致。

---

# 3. 模块架构

```text
src/
├── core/
│   ├── pipeline.ts
│   ├── context.ts
│   └── errors.ts
├── parser/
│   ├── fact-parser.ts
│   ├── entity-extractor.ts
│   └── editable-section-parser.ts
├── normalize/
│   ├── date-normalizer.ts
│   ├── emoji-normalizer.ts
│   └── copy-normalizer.ts
├── dedup/
│   └── semantic-deduper.ts
├── intent/
│   ├── card-intent-router.ts
│   ├── image-intent-router.ts
│   └── render-mode-router.ts
├── brand/
│   ├── brand-research.ts
│   ├── style-resolver.ts
│   └── style-cache.ts
├── design/
│   ├── information-architect.ts
│   ├── attention-engine.ts
│   ├── image-planner.ts
│   └── interaction-planner.ts
├── renderer/
│   ├── card-json-renderer.ts
│   ├── template-registry.ts
│   └── preview-renderer.ts
├── feishu/
│   ├── auth.ts
│   ├── cardkit-client.ts
│   ├── message-client.ts
│   ├── callback-handler.ts
│   └── scope-resolver.ts
├── operation/
│   └── operation-copy-generator.ts
├── qa/
│   ├── fact-qa.ts
│   ├── information-qa.ts
│   ├── brand-qa.ts
│   ├── image-qa.ts
│   ├── navigation-qa.ts
│   └── feishu-qa.ts
└── output/
    └── bundle-writer.ts
```

---

# 4. 核心数据结构

## 4.1 RawInput

```ts
interface RawInput {
  copy: string;
  userInstruction?: string;
  brandName?: string;
  referenceImages?: string[];
  knownLinks?: Array<{
    label?: string;
    url: string;
    type?: string;
  }>;
  publishTarget?: {
    chatId?: string;
  };
}
```

---

## 4.2 SourceOfTruth

```ts
interface SourceOfTruth {
  project_name?: string;
  activity_name?: string;
  card_purpose?: string;

  dates: FactField[];
  times: FactField[];
  deadlines: DeadlineFact[];
  locations: FactField[];
  people: FactField[];
  actions: ActionFact[];
  links: LinkFact[];
  submission_requirements: FactField[];
  rules: FactField[];
  rewards: FactField[];
  status: FactField[];
  brand_entities: FactField[];

  ai_editable_sections: EditableSection[];
  uncertain_information: UncertainFact[];

  raw_copy_hash: string;
}
```

所有 FactField 应携带 source span：

```ts
interface FactField {
  value: string;
  source_text: string;
  start?: number;
  end?: number;
  locked: boolean;
}
```

关键原则：

> 最终卡片中的所有 Locked Fact 必须能回指 `source_text`。

---

# 5. Fact Lock 规范

Locked 类型至少包括：

```text
activity_name
project_name
brand_name
person_name
date
time
deadline
number
location
url
reward
rule
submission_requirement
```

生成阶段禁止覆盖 locked value。

允许变化：

```text
8.9 → 8月9日
0809 → 8月9日
```

这种变化记为：

```json
{
  "source": "8.9",
  "normalized": "8月9日",
  "semantic_equal": true
}
```

---

# 6. 日期标准化

## 6.1 输入支持

```text
0809
8.9
08.09
8/9
08/09
8-9
08-09
8月9
8月9日
```

输出统一：

```text
8月9日
```

区间：

```text
8.9-8.15
→ 8月9日—8月15日
```

---

## 6.2 禁止行为

不得：

- 自动补年份
- 自动补星期
- 自动更换时区
- 自动推断“今天”
- 未拿到可信当前日期时生成倒计时

---

# 7. Emoji 处理

规则：

1. 原始 Emoji 保持原字符
2. `[喇叭]` 这类文本仅在语义明确时可转为 `📣`
3. 禁止 `📣 → 【喇叭】`
4. Emoji 仅作为扫描锚点，不参与事实表达
5. 同一模块默认 0～1 个 Emoji

---

# 8. 语义去重

## 8.1 去重对象

重点处理：

- deadline 重复
- 同义提醒
- 链接重复
- 同一任务重复
- 活动名称机械重复
- CTA 与正文重复

---

## 8.2 去重策略

候选句两两计算：

```text
Exact Match
→ Normalized Match
→ Semantic Match
→ Functional Role Check
```

若语义相同且 UI 功能相同：

删除低优先级表达。

若语义相同但功能不同：

允许保留。

例如：

```text
正文：9月4日截止
按钮：提交作品
```

保留。

---

# 9. Card Intent Router

必须输出：

```json
{
  "primary_intent": "timeline",
  "primary_question": "什么时候需要做什么？",
  "primary_action": "按节点完成任务",
  "recommended_layout": "vertical_timeline",
  "confidence": 0.93
}
```

支持枚举：

```text
timeline
deadline
training
submission
case_showcase
announcement
registration
result
award
reminder
countdown
guide
custom
```

confidence < 0.65：

进入 fallback：

```text
announcement + conservative layout
```

不得自行发明活动语义。

---

# 10. Render Mode Router

新增三个核心模式：

```text
text_first
image_assisted
image_led_navigation
```

## 10.1 text_first

适用：

- Deadline
- Submission
- 短提醒
- 强精确事实

布局：

```text
Header
Primary Fact
Supporting Copy
Primary CTA
```

---

## 10.2 image_assisted

适用：

- 培训通知
- 案例推荐
- 活动通知

布局：

```text
Header
Hero Image / Summary Image
Primary Fact
Primary CTA
Secondary Info
```

---

## 10.3 image_led_navigation

适用：

- 课程总览
- 多专题
- 多入口导航
- 多场景案例库

布局：

```text
Header
Information Image
Primary CTA
Secondary CTA Grid
Optional Note
```

---

# 11. Image Intent Router

输出：

```json
{
  "image_mode": "required",
  "image_role": "schedule_overview",
  "reason": "存在两个系列、多日排期和多个入口，图片比纯文本更利于扫读",
  "text_to_image_ratio": "30_70"
}
```

枚举：

```text
image_mode:
required | recommended | optional | not_needed

image_role:
hero_summary
schedule_overview
module_summary
scene_navigation
case_summary
```

---

# 12. ImagePlan

```ts
interface ImagePlan {
  role: string;
  aspect_ratio: string;
  safe_text_zones: Array<Rect>;
  hero_title: string;
  hero_subtitle?: string;
  modules: ImageModule[];
  critical_facts_repeated_in_card: string[];
  prompt: string;
  negative_prompt?: string;
}
```

关键规则：

- 精确截止时间不得只存在图片里
- CTA 不得只画在图片里
- 关键 URL 不得烘焙进图片
- 图片里重要文字要适合移动端
- 若 AI 图片模型文字可靠性不足，必须生成“背景/插画 + 卡片原生文字层”，而不是把中文硬生成在图里

---

# 13. 信息架构输出

建议结构：

```ts
interface CardStructure {
  header: HeaderBlock;
  primaryAnchor: ContentBlock;
  body: ContentBlock[];
  image?: ImagePlan;
  ctas: CTA[];
  footer?: ContentBlock[];
}
```

每个 ContentBlock：

```ts
interface ContentBlock {
  type: "text" | "timeline" | "badge" | "columns" | "image" | "note";
  priority: 1 | 2 | 3;
  content: unknown;
  sourceFactIds?: string[];
}
```

---

# 14. CTA 规范

```ts
interface CTA {
  label: string;
  type: "url" | "callback";
  url?: string;
  callbackKey?: string;
  priority: "primary" | "secondary";
  sourceFactId?: string;
}
```

规则：

- Primary ≤ 1
- Secondary ≤ 4
- 按钮必须是动作导向
- URL 不存在时不得编造
- 同一个 CTA 不得重复
- 图片中的模块与 CTA 尽可能建立映射

---

# 15. 飞书渲染层

Renderer 输入：

```text
SourceOfTruth
+ CardIntent
+ RenderMode
+ StyleProfile
+ CardStructure
```

输出：

```text
card.json
card.preview.json
```

实现原则：

1. 优先 Card JSON 2.0
2. 组件能力运行前根据当前官方 Schema 校验
3. 不把某个 CLI 写死为依赖
4. 有 Feishu SDK 时复用
5. CardKit 创建 / 更新作为独立 Adapter
6. 业务 Callback 与纯 URL Jump 分开

---

# 16. Feishu Adapter

建议接口：

```ts
interface FeishuCardAdapter {
  createCard(cardJson: unknown): Promise<CreateCardResult>;
  sendCard(target: SendTarget, cardRef: string): Promise<SendResult>;
  updateCard(cardRef: string, cardJson: unknown): Promise<UpdateResult>;
  validateCard(cardJson: unknown): Promise<ValidationResult>;
}
```

---

# 17. 认证

环境变量：

```env
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
FEISHU_ENCRYPT_KEY=
```

禁止：

- Secret 硬编码
- Secret 输出日志
- Token 写入 Git
- `.env` 提交仓库

必须提供：

```text
.env.example
.gitignore
```

---

# 18. Callback Handler

基础路由：

```text
POST /api/feishu/card/callback
```

处理：

```text
signature verification
→ event parsing
→ idempotency
→ action dispatch
→ business response
→ optional card update
```

必须覆盖：

- duplicate click
- expired action
- invalid payload
- permission error
- API error
- network error
- timeout

---

# 19. QA Pipeline

QA 必须在输出前执行。

```text
Fact QA
→ Information QA
→ Brand QA
→ Image QA
→ Navigation QA
→ Feishu QA
```

最终：

```json
{
  "score": 92,
  "pass": true,
  "issues": []
}
```

`score < 85`：

自动进入一次 Rewrite。

最大自动 Rewrite 次数建议：

```text
2
```

避免死循环。

---

# 20. Fact QA

必须保证：

- Locked Facts 均能追溯
- 无新增事实
- 日期一致
- URL 一致
- 活动名称一致
- 人名一致
- 奖项一致
- 数字一致
- Emoji 未文字化
- 无关键节点遗漏

任何硬错误：

```text
pass = false
```

无视总分。

---

# 21. Image QA

检查：

```text
是否承担信息
是否比纯文字更优
是否手机可读
是否模块清楚
是否与 CTA 对应
是否有无意义装饰
关键事实是否仍由卡片原生文字承接
```

---

# 22. 输出 Bundle

每次生成：

```text
outputs/{timestamp-or-slug}/
├── source_of_truth.json
├── intent.json
├── render_plan.json
├── style.md
├── card_content.md
├── card.json
├── card.preview.json
├── operation_copy.md
├── qa_report.json
└── assets/
    ├── image_prompt.md
    └── ...
```

---

# 23. 品牌缓存

目录：

```text
brands/
└── {brand-slug}/
    ├── style.md
    ├── research.json
    └── assets.json
```

默认策略：

```text
有品牌 style → 复用
没有 → Research → 生成 → 缓存
用户强制刷新 → 重新调研
```

---

# 24. Template Registry

模板定义不包含具体文案，只包含布局策略。

例如：

```ts
registerTemplate("image_schedule_overview", {
  requiredBlocks: ["header", "image", "primaryCTA"],
  maxSecondaryCTA: 4,
  renderMode: "image_led_navigation"
});
```

---

# 25. Error Handling

统一错误：

```text
FACT_CONFLICT
MISSING_REQUIRED_FACT
INVALID_URL
INVALID_CARD_SCHEMA
FEISHU_AUTH_ERROR
FEISHU_PERMISSION_ERROR
IMAGE_GENERATION_ERROR
CALLBACK_ERROR
BRAND_RESEARCH_ERROR
```

原则：

- 事实冲突不自动猜
- 非关键视觉失败可降级
- 图片失败 → 降级 text_first / image_assisted
- Feishu 发布失败不影响生成文件输出

---

# 26. Fallback 设计

## 图片生成失败

```text
image_led_navigation
→ image_assisted
→ text_first
```

## 品牌调研失败

使用：

```text
AI先锋大赛默认 Style
```

## CTA URL 缺失

删除按钮，不虚构链接。

## CardKit API 不可用

仍输出：

```text
card.json
card_content.md
```

状态：

```text
Generated / Not Published
```

---

# 27. 测试要求

## Unit Tests

至少：

```text
date-normalizer
emoji-preserver
fact-lock
semantic-dedup
intent-router
render-mode-router
cta-builder
image-plan
fact-qa
```

---

## Integration Tests

场景：

1. 时间线
2. 截止提醒
3. 培训卡
4. 提交卡
5. 案例卡
6. 图片课程总览
7. 多按钮导航
8. 无 URL
9. 重复文案
10. 事实冲突

---

# 28. Golden Tests

### GT-01 名称保真

输入：

```text
AI先锋大赛
```

必须：

```text
AI先锋大赛
```

不得：

```text
先锋大赛
```

### GT-02 日期

```text
0809 → 8月9日
```

### GT-03 Emoji

```text
📣 → 📣
```

### GT-04 图片导航

输入：

```text
两个系列课程
每个系列 5 天
有查看课程表入口
有财务 / 销售 / 客服专题入口
```

必须选择：

```text
render_mode = image_led_navigation
```

### GT-05 URL

无 URL 时：

不得生成假按钮链接。

---

# 29. 性能目标

普通文本卡：

```text
P95 < 20s
```

含品牌调研 / 图片规划：

```text
P95 < 60s
```

不包含第三方图片生成本身耗时。

---

# 30. 研发完成定义 DoD

只有满足以下条件才可称 v1.1 完成：

- [ ] P0 功能全部实现
- [ ] 6 个基础模板完成
- [ ] 3 个 Render Mode 完成
- [ ] Source of Truth 可追溯
- [ ] QA 强校验完成
- [ ] Card JSON 可输出
- [ ] 图片型卡片可生成计划与 Prompt
- [ ] 多按钮导航可生成
- [ ] operation_copy.md 可输出
- [ ] Golden Tests 全通过
- [ ] README 可运行
- [ ] `.env.example` 完整
- [ ] 没有 Secret 泄露
- [ ] 发布状态能够区分 Generated / Configured / Tested

---

**SPEC END**


---

# 31. Mobile First Technical Specification

## 31.1 Pipeline 更新

v1.2 强制增加：

```text
...
Information Architecture
→ Mobile Layout Pass
→ Image Mobile Pass
→ CTA Mobile Pass
→ Desktop Enhancement
→ Card JSON Render
→ Cross-device QA
```

原则：

> Mobile Layout Pass 先于 Desktop Enhancement。

---

# 32. DeviceProfile

新增：

```ts
interface DeviceProfile {
  primarySurface: "mobile";
  targets: Array<"ios" | "android" | "desktop">;
  mobileFirst: true;
  allowHorizontalScroll: false;
  preferredColumns: 1;
  maxTextColumns: 2;
  preferredPrimaryCTA: "full_width";
}
```

默认：

```json
{
  "primarySurface": "mobile",
  "targets": ["ios", "android", "desktop"],
  "mobileFirst": true,
  "allowHorizontalScroll": false,
  "preferredColumns": 1,
  "maxTextColumns": 2,
  "preferredPrimaryCTA": "full_width"
}
```

---

# 33. MobileLayoutPlan

```ts
interface MobileLayoutPlan {
  readingOrder: string[];
  columnStrategy: "single" | "limited_two_column";
  primaryAnchorPosition: "top";
  primaryCTAPlacement: "early" | "after_primary_content";
  secondaryCTAStyle: "stacked" | "two_column";
  maxSecondaryCTAPerRow: 1 | 2;
  imageMode: "hero" | "information" | "none";
  imageReadableWithoutZoom: boolean;
  criticalFactsAboveFold: string[];
  warnings: string[];
}
```

---

# 34. Mobile Layout Rules

## 34.1 Default

```text
single column
```

## 34.2 Two-column allowed only when

```text
each block <= 2 short lines
AND no nested list
AND no long CTA
AND no critical sequence dependency
```

## 34.3 Disallowed

```text
3+ text columns
wide tables
horizontal timeline requiring pan
nested multi-column layouts
desktop-only visual order
```

---

# 35. Reading Order Serializer

Renderer 必须维护显式：

```ts
mobileReadingOrder: string[]
```

例如：

```json
[
  "header",
  "primary_deadline",
  "submission_action",
  "hero_image",
  "primary_cta",
  "supporting_note"
]
```

即使桌面端使用并排布局：

手机端也必须保持这个语义顺序。

---

# 36. Mobile CTA Rules

建议渲染策略：

```ts
if (cta.priority === "primary") {
  layout = "full_width";
}

if (secondaryCtas.length <= 2 && allLabelsShort) {
  layout = "two_column";
} else {
  layout = "stacked";
}
```

短标签建议：

```text
<= 8 个中文字符
```

这是内部设计阈值，不是飞书平台硬限制。

---

# 37. Touch Interaction Guard

生成按钮时 QA：

```text
no tiny inline link as primary action
no crowded button row
no visually ambiguous adjacent actions
```

Button 必须有清晰间距。

---

# 38. Mobile Image Specification

## 38.1 Asset Profiles

建议生成：

```ts
interface ImageAssetVariant {
  usage: "mobile" | "desktop" | "universal";
  aspectRatio: string;
  minReadableTextSizePx?: number;
  containsCriticalText: boolean;
  cropSafe: boolean;
}
```

---

## 38.2 推荐比例策略

不是飞书硬限制，而是本 Skill 的设计策略：

### Hero / Atmosphere

```text
16:9 / 3:2
```

### Information-rich

优先：

```text
4:3 / 1:1 / 3:4
```

避免将大量信息塞入超宽横图。

---

## 38.3 Critical Text

如果图片中存在核心事实：

必须在 `criticalFactsRepeatedInNativeCardText` 中列出。

例如：

```json
{
  "criticalFactsRepeatedInNativeCardText": [
    "9月4日截止",
    "提交作品"
  ]
}
```

---

# 39. Mobile Image Readability Heuristic

图片计划阶段计算：

```text
moduleCount
textLineCount
aspectRatio
estimatedFontScale
```

若：

```text
moduleCount > 4
OR imageTextLineCount > 12
OR estimatedMobileReadability < threshold
```

则：

```text
split image
OR reduce content
OR move text to native components
```

---

# 40. Deep Link Resolver

新增：

```ts
interface LinkTarget {
  universal?: string;
  pc?: string;
  ios?: string;
  android?: string;
}
```

注意：

- 只有当前飞书官方 Schema 明确支持对应字段时才写入
- 运行时 Schema 校验不过时自动退回 `universal`
- Primary CTA 的 universal URL 必须首先在移动端可用

---

# 41. Feishu Client Compatibility

Card JSON 2.0 / CardKit 应按飞书当前官方客户端兼容范围进行校验。

实现时新增：

```ts
interface ClientCompatibility {
  minSupportedVersion?: string;
  iosChecked: boolean;
  androidChecked: boolean;
  desktopChecked: boolean;
}
```

如果使用当前客户端版本才支持的组件：

必须在 README / QA Report 中标明。

不得无提示使用可能导致旧客户端降级异常的组件。

---

# 42. CrossDeviceQARunner

新增：

```ts
interface CrossDeviceQAResult {
  mobile: {
    pass: boolean;
    issues: string[];
  };
  ios: {
    pass: boolean;
    issues: string[];
  };
  android: {
    pass: boolean;
    issues: string[];
  };
  desktop: {
    pass: boolean;
    issues: string[];
  };
}
```

Mobile Fail：

```text
Overall Fail
```

Desktop Minor Issue：

允许在不影响核心行动时进入 Warning。

---

# 43. Mobile Test Matrix

至少覆盖：

| Case | iOS | Android | Desktop |
|---|---|---|---|
| Timeline | Required | Required | Required |
| Deadline | Required | Required | Required |
| Training | Required | Required | Required |
| Submission | Required | Required | Required |
| Image Assisted | Required | Required | Required |
| Image Led Navigation | Required | Required | Required |
| 4 CTA | Required | Required | Required |
| Long Chinese Labels | Required | Required | Required |

---

# 44. Mobile Golden Tests

## MGT-01 三按钮

输入：

```text
财务专场 / 销售专场 / 客服专场
```

禁止：

```text
三个按钮同一行挤压
```

期望：

```text
stacked
或
2 + 1
```

---

## MGT-02 信息图

如果图中包含：

```text
10 个课程模块 + 小字课程表
```

必须：

```text
fail image readability
→ split / reduce / native text
```

---

## MGT-03 Deadline

手机首屏必须优先看到：

```text
9月4日截止
提交作品
Primary CTA
```

---

## MGT-04 Desktop Two-column

桌面端允许双栏时：

手机必须：

```text
正确堆叠
+
阅读顺序不改变
```

---

# 45. Output 更新

新增：

```text
outputs/
├── mobile_layout.json
├── cross_device_qa.json
└── assets/
    ├── mobile/
    └── desktop/
```

其中 `mobile_layout.json` 必须存在。

---

# 46. DoD 更新

v1.2 完成标准新增：

- [ ] Mobile Layout Pass 已实现
- [ ] 所有 P0 模板有移动端布局
- [ ] iOS QA 完成
- [ ] Android QA 完成
- [ ] Primary CTA 手机端策略完成
- [ ] Image Readability Guard 完成
- [ ] Multi-column Mobile Fallback 完成
- [ ] Mobile Deep-link Check 完成
- [ ] Cross-device QA 报告可输出
- [ ] Mobile Fail 会阻止发布

