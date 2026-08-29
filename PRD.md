# AI先锋大赛智能飞书卡片 Skill — 产品需求文档 PRD

**版本**：v1.0  
**状态**：Draft / 可进入开发  
**产品名称**：AI先锋大赛智能飞书卡片 Skill  
**产品形态**：Agent Skill + Feishu CardKit / Card JSON 2.0 生成器 + 品牌设计系统 + 运营文案助手  
**核心使用场景**：AI先锋大赛活动运营、培训通知、时间线、作品提交、截止提醒、案例展示、结果公布等飞书群卡片  
**目标用户**：活动运营人员、CSM、客户成功团队、赛事负责人、飞书生态实施人员  

---

# 1. 产品背景

AI先锋大赛在实际运营过程中，会持续产生大量需要通过飞书群传播的信息，包括：

- 活动时间线
- 培训通知
- 作品提交提醒
- 截止时间提醒
- 优秀案例展示
- 决赛通知
- 路演安排
- 结果公布
- 活动 FAQ
- 报名 / 提交 / 查看详情入口

当前人工制作卡片存在四个核心问题：

1. **信息层级不稳定**  
   同一份文案由不同人员制作时，重点信息可能被埋没，用户无法快速知道“什么时候、做什么、下一步是什么”。

2. **视觉质量依赖设计能力**  
   卡片容易退化为“把文字塞进组件”，缺乏统一品牌语言与高级感。

3. **事实容易在 AI 优化过程中发生漂移**  
   活动名、日期、时间、链接、规则、人物等一旦被 AI 擅自修改，会直接造成运营事故。

4. **卡片、交互、运营话术彼此割裂**  
   卡片只是静态内容，没有充分利用按钮、跳转、状态更新、回调等飞书交互能力，也缺乏发卡前后的群运营配套。

因此需要构建一个专门面向 AI先锋大赛的智能卡片 Skill。

---

# 2. 产品定义

AI先锋大赛智能飞书卡片 Skill 是一个：

> 将“原始活动文案”自动编译为“结构化事实 + 信息架构 + 品牌视觉 + 飞书交互卡片 + 运营话术”的智能 Agent Skill。

输入可以是一段未经整理的自然语言文案，例如：

> AI先锋大赛，9月4日作品提交截止，还没提交作品的小伙伴记得尽快提交，提交地址 xxx，作品提交将在9月4日截止，📣 大家记得不要错过。

Skill 输出：

1. 结构化事实
2. 卡片意图判断
3. 信息优先级
4. 去重后的卡片文案
5. 标准化日期
6. 品牌 style.md
7. 飞书 Card JSON
8. 按钮 / 交互定义
9. 素材与图片提示词
10. 发卡前、发卡时、发卡后的运营话术
11. Fact QA / Visual QA / Feishu QA

---

# 3. 产品第一性原理

## 3.1 核心原则

卡片的第一目标不是“好看”。

卡片的第一目标是：

> **让用户在 3～5 秒内获得最重要的信息，并明确知道下一步应该做什么。**

产品优先级始终为：

**信息传达效率 > 信息层级 > 行动效率 > 品牌一致性 > 美观性**

---

## 3.2 三个必须回答的问题

任何卡片生成完成后，必须能够回答：

### 3 秒问题
用户能否在 3 秒内知道：

> 这张卡在说什么？

### 5 秒问题
用户能否在 5 秒内知道：

> 和我有什么关系？

### 行动问题
用户是否明确知道：

> 下一步我要做什么？

只要任一问题失败，卡片需要重新生成。

---

# 4. 产品目标

## 4.1 核心目标

### G1：降低信息理解成本
将非结构化活动文案自动转为高信息密度、低认知负担的卡片。

### G2：保证事实 100% 可追溯
日期、时间、链接、名称、人员、规则等关键事实不得被 AI 篡改。

### G3：形成统一赛事视觉系统
AI先锋大赛所有卡片保持同一母视觉语言，同时允许根据不同客户品牌进行适配。

### G4：让卡片具备行动能力
优先使用按钮、跳转、回调、状态更新等能力，而不是把链接和操作说明堆成文字。

### G5：降低活动运营工作量
一次输入同时完成卡片内容、视觉、交互和群运营话术。

---

# 5. 非目标

v1.0 阶段不解决：

- 自动替代完整活动项目管理系统
- 自动替代飞书多维表格
- 自动修改比赛规则
- 自动生成未经确认的奖项、时间、地点
- 自动代表运营人员发送外部通知
- 未授权情况下自动发布卡片
- 自动读取企业内部敏感资料
- 自动执行高风险业务操作

---

# 6. 用户角色

## Persona A：活动运营 / CSM

### 需求
每天需要在群内发布多张活动通知卡片。

### 痛点
- 文案很多
- 时间紧
- 不会设计
- 信息容易重复
- 卡片容易出现“文字墙”
- 每次都要自己写群运营话术

### 目标
复制一段原始文案后，几分钟内得到可直接发送的高质量卡片。

---

## Persona B：赛事负责人

### 需求
保证活动信息准确。

### 痛点
最担心：
- 日期错误
- 比赛名称错误
- 截止时间错误
- 链接错误
- AI 自作主张修改规则

### 目标
每个关键事实都能追溯到原始输入。

---

## Persona C：设计 / 品牌人员

### 需求
保证赛事和企业品牌统一。

### 痛点
AI 常生成：
- 廉价科技蓝
- 赛博朋克
- 霓虹灯
- 过度渐变
- 不符合企业品牌

### 目标
通过统一 style.md 控制视觉。

---

## Persona D：开发 / 飞书实施人员

### 需求
把生成结果直接用于飞书。

### 目标
获得结构清晰、可验证、可修改的 Card JSON，并明确交互、权限和回调要求。

---

# 7. 核心用户场景

系统必须至少支持以下卡片类型：

| 类型 | 用户核心问题 | 第一视觉重点 |
|---|---|---|
| Timeline 时间线 | 什么时候做什么？ | 日期 + 事件 |
| Deadline 截止提醒 | 最晚什么时候完成？ | 截止时间 |
| Training 培训 | 什么时候上什么课？ | 培训主题 + 时间 |
| Submission 提交 | 我要交什么？ | 提交内容 + 截止 |
| Case Showcase 案例 | 这个案例值得看什么？ | 场景 / 亮点 |
| Announcement 通知 | 发生什么？ | 通知主题 |
| Registration 报名 | 怎么参加？ | 报名信息 + CTA |
| Result 结果 | 谁进入下一阶段？ | 结果 |
| Award 奖项 | 获奖信息是什么？ | 奖项 + 对象 |
| Reminder 提醒 | 现在最需要注意什么？ | 当前任务 |
| Countdown 倒计时 | 还剩多久？ | 时间状态 |
| Guide 指南 | 怎么操作？ | 操作步骤 |

---

# 8. 整体产品流程

```text
用户输入原始文案
        ↓
01 Source Parser
事实提取
        ↓
02 Fact Locker
事实锁定
        ↓
03 Normalizer
日期 / Emoji / 格式标准化
        ↓
04 Semantic Dedup
语义去重
        ↓
05 Intent Router
判断卡片类型
        ↓
06 Attention Engine
判断第一视觉重点
        ↓
07 Information Architect
重组信息层级
        ↓
08 Brand Research
品牌视觉调研
        ↓
09 Style Generator
生成 / 调用 style.md
        ↓
10 Card Composer
设计卡片结构
        ↓
11 Interaction Planner
规划按钮 / 跳转 / 回调
        ↓
12 Feishu Renderer
生成 Card JSON 2.0 / CardKit 数据
        ↓
13 Operation Copy Generator
生成群运营话术
        ↓
14 QA Engine
事实 / 信息 / 品牌 / 技术检查
        ↓
最终输出
```

---

# 9. 功能需求

# 9.1 FR-01 原始文案解析

**优先级：P0**

系统必须从原始自然语言中识别：

- 项目名称
- 活动名称
- 日期
- 时间
- 截止时间
- 地点
- 人物
- 行动
- URL
- 提交要求
- 比赛规则
- 奖项
- 当前状态
- 品牌主体
- AI 可编辑区域

输出：

`source_of_truth.json`

示例：

```json
{
  "activity_name": "AI先锋大赛",
  "dates": ["9月4日"],
  "deadlines": [
    {
      "date": "9月4日",
      "action": "作品提交"
    }
  ],
  "links": [
    {
      "type": "submission",
      "url": "https://example.com"
    }
  ]
}
```

---

# 9.2 FR-02 Fact Locker 事实锁

**优先级：P0**

系统必须区分：

## Locked Facts
禁止修改：

- 活动名
- 企业名
- 人名
- 数字
- 日期
- 时间
- 地点
- URL
- 奖项
- 比赛规则
- 提交规则

## Editable Copy
允许调整：

- 表达顺序
- 冗余语句
- 辅助说明
- CTA 文案
- 标题层级
- Emoji
- 排版

只有用户明确要求“优化 / 改写 / 补充”的内容才可以进行创作性改写。

---

# 9.3 FR-03 日期标准化

**优先级：P0**

系统必须统一常见日期：

```text
0809      → 8月9日
08/09     → 8月9日
8/9       → 8月9日
8.9       → 8月9日
08-09     → 8月9日
8月9      → 8月9日
```

区间：

```text
8.9-8.15
↓
8月9日—8月15日
```

不得自动：

- 添加年份
- 添加星期
- 修改时区
- 推测时间

---

# 9.4 FR-04 Emoji 语义保持

**优先级：P0**

Emoji 必须保持字符形式。

正确：

`📣 AI先锋大赛`

错误：

`【喇叭】AI先锋大赛`

段落应优先使用与语义相关的 Emoji 作为扫描锚点，但不得滥用。

建议映射：

- 📅 日期
- ⏰ 截止
- 📍 地点
- 🎯 任务
- 📤 提交
- 🏆 奖项
- 🎓 培训
- 💡 提示
- 👥 人员
- 🔗 链接

---

# 9.5 FR-05 语义去重

**优先级：P0**

同一个事实原则上只表达一次。

输入：

```text
9月4日截止提交。
请大家9月4日前提交。
作品提交截止时间是9月4日。
```

输出：

`⏰ 作品提交截止：9月4日`

允许功能性重复：

Header：
`9月4日截止`

Button：
`提交作品`

---

# 9.6 FR-06 Card Intent Router

**优先级：P0**

AI 必须先判断卡片类型，再决定布局。

输出：

```json
{
  "primary_intent": "timeline",
  "primary_question": "什么时候需要做什么？",
  "primary_action": "按节点完成比赛任务",
  "recommended_layout": "vertical_timeline"
}
```

Intent Router 不得跳过。

---

# 9.7 FR-07 Attention Engine

**优先级：P0**

系统需自动判断：

- Primary Attention Anchor
- Secondary Attention Anchor
- Supporting Information

每张卡最多：

- 1 个 Primary
- 2～3 个 Secondary
- N 个 Supporting

禁止：

- 所有内容同字号
- 所有内容全部加粗
- 多个高饱和元素竞争

---

# 9.8 FR-08 信息架构生成

**优先级：P0**

不同卡片使用不同结构。

## Timeline

```text
日期
↓
任务
↓
状态
↓
辅助说明
```

## Deadline

```text
截止日期
↓
需要完成什么
↓
要求
↓
CTA
```

## Training

```text
培训主题
↓
时间
↓
内容
↓
入口
```

## Submission

```text
提交内容
↓
截止时间
↓
提交要求
↓
提交按钮
```

---

# 9.9 FR-09 文字密度控制

**优先级：P0**

禁止出现大段文字墙。

规则：

- 一个信息模块建议 1～3 行
- 超过 4 行需重新拆分
- 多步骤信息使用 Timeline / List / Step
- 链接优先转按钮
- 次级内容优先折叠或跳转

---

# 9.10 FR-10 Progressive Disclosure

**优先级：P1**

信息划分：

### L1
不点击必须看到。

例如：
- 活动名称
- 当前任务
- 截止时间

### L2
需要阅读时查看。

例如：
- 简短规则
- 注意事项

### L3
点击后查看。

例如：
- 完整规则
- 长篇教程
- 详细案例

---

# 9.11 FR-11 Button / CTA 生成

**优先级：P0**

检测到可行动信息时优先生成按钮。

例如：

- 提交作品
- 查看规则
- 加入培训
- 打开案例
- 查看详情
- 联系负责人
- 立即报名

按钮文案必须：

> 动词 + 对象

禁止：

- 点这里
- 链接
- 详情
- 点击查看

单卡建议：

- Primary CTA ≤ 1
- Secondary CTA ≤ 2

---

# 9.12 FR-12 品牌调研

**优先级：P1**

当输入包含明确企业 / 品牌时，自动进行视觉调研。

优先信息源：

1. 官方网站
2. 官方品牌页面
3. 官方公众号 / 社媒
4. 官方 Logo
5. 官方空间 / 产品图片
6. 官方活动视觉

调研：

- 主色
- 辅助色
- Logo
- 字体气质
- 空间语言
- 产品定位
- 品牌关键词
- 图片风格
- 用户群体

禁止仅根据品牌名字猜风格。

---

# 9.13 FR-13 Style Generator

**优先级：P0**

生成或调用：

`style.md`

至少包含：

```text
Brand Identity
Brand Keywords
Visual Direction
Emotional Tone
Color System
Gradient
Typography
Radius
Border
Shadow
Spacing
Icon Style
Emoji Usage
Image Style
Illustration Style
Motion Language
Header
Button
Timeline
Badge
Do
Don't
```

---

# 9.14 FR-14 AI先锋大赛默认视觉

**优先级：P0**

没有客户品牌约束时：

**Premium AI × Feishu Native × iOS Editorial**

关键词：

- 高级
- 克制
- 低饱和
- 浅色
- 通透
- 精致
- 微渐变
- 微纹理
- 大留白
- 清晰层级
- 数字感
- 动态感

禁止默认：

- Cyberpunk
- 电竞 UI
- 廉价科技蓝
- 大面积霓虹
- 强发光
- PPT 模板风

---

# 9.15 FR-15 Header System

**优先级：P1**

默认 Header 结构：

```text
[Logo] AI先锋大赛          [日期 / 状态 Badge]

PIONEER ROADMAP · 作品交付
```

视觉特征：

- Logo + 品牌名
- 日期 / 状态 Badge
- 主副标题层级
- 高级低饱和渐变
- 极轻纹理
- 大留白
- 高对比文字

不要求每张卡完全相同，但必须保持母设计语言一致。

---

# 9.16 FR-16 图片与素材策略

**优先级：P1**

AI 必须判断：

> 这张卡真的需要图片吗？

允许：

- Hero
- 品牌空间
- 产品
- 讲师
- 案例
- 奖项
- 活动主视觉

禁止：

为了“高级感”无意义添加 AI 图片。

如需生成图片提示词，自动加载 style.md。

---

# 9.17 FR-17 Motion

**优先级：P2**

仅在飞书当前能力和素材形式支持时使用动态内容。

建议：

- slow gradient drift
- subtle shimmer
- breathing highlight
- low-amplitude particle

禁止：

- 持续闪烁
- 高速移动
- 大面积发光
- 干扰阅读

---

# 9.18 FR-18 Feishu Renderer

**优先级：P0**

输出：

- Card JSON
- Card JSON Preview
- Card content Markdown
- 交互配置
- 权限需求
- 回调说明

技术实现优先：

1. Feishu CardKit
2. Card JSON 2.0
3. Feishu OpenAPI
4. Card Builder / 官方卡片搭建能力
5. 项目已有 SDK / CLI / MCP Wrapper

不得将“某个 CLI”写死为唯一实现路径。

---

# 9.19 FR-19 可编辑性

**优先级：P0**

输出目录：

```text
outputs/
├── card.json
├── card.preview.json
├── card_content.md
├── source_of_truth.json
├── style.md
├── operation_copy.md
└── assets/
```

用户必须可以继续修改：

- 文案
- 图片
- Button
- URL
- 颜色
- 布局
- Badge

---

# 9.20 FR-20 卡片发送

**优先级：P1**

发布前必须区分：

### Generated
已经生成 JSON / 代码。

### Configured
飞书 App / 权限 / Credential 已配置。

### Tested
真实发送测试成功。

只有 Tested 才允许提示：

> 已成功打通飞书。

---

# 9.21 FR-21 卡片交互 Callback

**优先级：P1**

按钮涉及业务回传时：

必须设计 Callback Handler。

至少处理：

- 成功
- 参数错误
- 权限错误
- API Error
- Network Error
- Duplicate Click
- Expired Action

用户操作后必须获得反馈。

---

# 9.22 FR-22 动态状态卡

**优先级：P2**

允许赛事时间线进一步演化为动态卡片：

```text
待开始
↓
进行中
↓
已完成
```

应用场景：

- 培训状态
- 作品提交状态
- 评审状态
- 决赛状态

优先更新同一张卡，而不是重复发送大量通知。

---

# 9.23 FR-23 运营话术生成

**优先级：P0**

每张卡同步输出：

`operation_copy.md`

包括：

### 发卡前
活跃群气氛。

### 发卡时
一句核心说明。

### 发卡后
引导互动。

### Deadline Reminder
截止提醒。

要求：

- 自然
- 简短
- 与卡片内容高度相关
- 不使用模板化公众号语气
- 不堆 Emoji
- 不生成重复信息

---

# 9.24 FR-24 上下文运营话术

**优先级：P1**

案例卡：

> 做销售场景的小伙伴可以重点看一下这个案例，里面这个 Agent 的拆法值得参考。

截止卡：

> 还没交作品的同学重点看一下，今天先保证完成可提交版本。

培训卡：

> 前面群里问多维表搭建比较多，今晚这场刚好会集中讲。

禁止所有卡统一输出：

> 朋友们快来看看！

---

# 10. Feishu 技术架构

```text
User Copy
    │
    ▼
AI Card Skill
    │
    ├── Fact Parser
    ├── Intent Router
    ├── Brand Agent
    ├── Style Engine
    ├── Card Composer
    ├── QA Engine
    │
    ▼
Card JSON 2.0 / CardKit
    │
    ▼
Feishu App / Bot
    │
    ├── Send Message
    ├── Card Entity
    ├── Button Interaction
    └── Callback
            │
            ▼
      Business Service
            │
            ├── Bitable
            ├── Docs
            ├── Submission Page
            └── Other APIs
```

---

# 11. 数据对象

## 11.1 Source of Truth

```json
{
  "project_name": "",
  "activity_name": "",
  "card_purpose": "",
  "dates": [],
  "times": [],
  "deadlines": [],
  "locations": [],
  "people": [],
  "actions": [],
  "links": [],
  "submission_requirements": [],
  "rules": [],
  "rewards": [],
  "status": [],
  "brand_entities": [],
  "ai_editable_sections": [],
  "uncertain_information": []
}
```

---

## 11.2 Card Intent

```json
{
  "primary_intent": "",
  "primary_question": "",
  "primary_action": "",
  "primary_attention_anchor": "",
  "secondary_attention_anchor": [],
  "recommended_layout": "",
  "recommended_interactions": []
}
```

---

# 12. 权限与安全

## 12.1 Credential

禁止：

- App Secret 写入源码
- Token 上传 Git
- Secret 写入卡片
- Secret 输出日志

采用：

```env
FEISHU_APP_ID=
FEISHU_APP_SECRET=
```

---

## 12.2 最小权限

系统必须根据真实 API 调用生成 Scope Checklist。

原则：

**Least Privilege**

只申请实际功能需要的飞书权限。

---

## 12.3 发布确认

v1.0 默认：

生成卡片 ≠ 自动发送。

发送必须有明确用户操作或预先配置的自动化规则。

---

# 13. QA 系统

# 13.1 Fact QA

发布前必须全部通过：

- [ ] AI先锋大赛名称正确
- [ ] 企业名称正确
- [ ] 日期正确
- [ ] 时间正确
- [ ] 数字正确
- [ ] URL 正确
- [ ] 人名正确
- [ ] Emoji 正确
- [ ] 奖项正确
- [ ] 无 AI 编造事实
- [ ] 无语义重复
- [ ] 无关键 Deadline 遗漏

---

# 13.2 Information QA

- [ ] 3 秒内能理解主题
- [ ] 5 秒内知道下一步行动
- [ ] 第一视觉是最重要信息
- [ ] 无文字墙
- [ ] CTA 明确
- [ ] 日期突出
- [ ] 手机端易扫读
- [ ] 次要信息没有抢注意力

---

# 13.3 Brand QA

- [ ] 使用正确 Logo
- [ ] 符合 style.md
- [ ] 主色正确
- [ ] 图片统一
- [ ] 没有无意义 Cyberpunk
- [ ] 系列卡片有统一性

---

# 13.4 Feishu QA

- [ ] Card JSON Schema Valid
- [ ] 组件当前可用
- [ ] URL 可访问
- [ ] Callback 正确
- [ ] Scope 完整
- [ ] Secret 未泄露
- [ ] Mobile Preview 正常
- [ ] Desktop Preview 正常
- [ ] Error 有 fallback

---

# 14. 自动评分系统

每张卡生成后自动评分：

| 指标 | 分值 |
|---|---:|
| Information Clarity | 30 |
| Attention Hierarchy | 20 |
| Action Clarity | 15 |
| Brand Consistency | 15 |
| Visual Quality | 10 |
| Feishu Native Experience | 10 |
| **总计** | **100** |

规则：

**< 85 分：自动进入 Rewrite / Redesign**

---

# 15. MVP

v1.0 必须实现：

### P0

- 原始文案输入
- Source of Truth
- Fact Lock
- 日期标准化
- Emoji 保持
- Semantic Dedup
- Intent Router
- Attention Engine
- 信息架构
- 6 类核心模板
- style.md
- Card JSON
- CTA 生成
- operation_copy.md
- Fact QA
- Information QA
- 飞书 JSON 校验

核心模板：

1. Timeline
2. Deadline
3. Training
4. Submission
5. Case
6. Announcement

---

# 16. V1.1

增加：

- 自动品牌 Web 调研
- Brand Profile Cache
- 飞书 Preview
- CardKit Create Card
- Bot 发送
- Callback
- Bitable 联动
- URL Checker
- Logo / Asset Manager
- 多尺寸图片生成 Prompt

---

# 17. V2

增加：

- 动态赛事状态卡
- 卡片自动更新
- 倒计时
- 卡片数据 Analytics
- A/B Testing
- 点击率追踪
- 内容理解效率评估
- 根据运营效果自动优化信息结构
- 多品牌 Design System
- 自动生成完整赛事运营素材

---

# 18. 成功指标

## Product Metrics

### 信息效率
- 卡片主要信息识别成功率 ≥ 95%
- 关键 Deadline 信息遗漏率 = 0
- 事实错误率目标 = 0

### 生成效率
- 普通卡片完整生成 < 60 秒
- 人工修改次数较传统方式下降 ≥ 60%

### 质量
- 自动评分平均 ≥ 90
- Fact QA Pass Rate = 100%

### 运营
后续可测：

- Button CTR
- Submission Conversion
- Training Attendance
- 群互动率
- 信息重复咨询量

其中很重要的反向指标：

> 卡片发布后，群里继续问“什么时候截止？”“在哪提交？”的次数应该持续下降。

---

# 19. Golden Test

输入：

```text
AI先锋大赛
9月4日作品提交截止
还没提交作品的小伙伴记得尽快提交
提交地址：https://example.com
作品提交将在9月4日截止
📣 大家记得不要错过
```

系统必须识别：

```json
{
  "activity_name": "AI先锋大赛",
  "primary_intent": "submission",
  "deadline": "9月4日",
  "action": "提交作品",
  "url": "https://example.com"
}
```

预期卡片：

```text
AI先锋大赛

📤 作品提交

⏰ 9月4日截止

📣 还没提交作品的小伙伴记得及时完成提交

[提交作品]
```

必须避免：

```text
9月4日截止
9月4日前提交
作品将在9月4日截止
不要错过9月4日
```

这种重复表达。

---

# 20. 核心验收标准

产品进入可用状态必须同时满足：

### AC-01
输入 `AI先锋大赛` 不得生成 `先锋大赛`。

### AC-02
输入 `0809` 必须展示为 `8月9日`。

### AC-03
输入 `📣` 不得生成 `【喇叭】`。

### AC-04
同一 Deadline 多次出现，只展示一次核心表达。

### AC-05
有 URL 时能够生成合理 CTA。

### AC-06
没有 URL 时不得虚构 URL。

### AC-07
Timeline 卡第一视觉必须是“日期 + 任务”。

### AC-08
Deadline 卡第一视觉必须是截止时间。

### AC-09
不得出现连续大段文字墙。

### AC-10
任何新事实必须能追溯到 Source of Truth。

### AC-11
生成结果必须包含可编辑 Card JSON。

### AC-12
生成结果必须包含 operation_copy.md。

### AC-13
QA < 85 分必须重新生成。

---

# 21. 推荐项目目录

```text
ai-pioneer-card-skill/
│
├── SKILL.md
├── README.md
│
├── prompts/
│   ├── source-parser.md
│   ├── intent-router.md
│   ├── card-designer.md
│   ├── brand-researcher.md
│   ├── operation-copy.md
│   └── qa-agent.md
│
├── schemas/
│   ├── source-of-truth.schema.json
│   ├── card-intent.schema.json
│   └── style.schema.json
│
├── style/
│   ├── ai-pioneer-default.md
│   └── brand-style-template.md
│
├── templates/
│   ├── timeline/
│   ├── deadline/
│   ├── training/
│   ├── submission/
│   ├── case/
│   └── announcement/
│
├── src/
│   ├── parser/
│   ├── normalization/
│   ├── intent/
│   ├── design/
│   ├── renderer/
│   ├── feishu/
│   ├── operation/
│   └── validation/
│
├── tests/
├── examples/
├── outputs/
├── .env.example
└── package.json / pyproject.toml
```

---

# 22. 产品最终形态

用户：

> 丢进一段乱糟糟的活动文案

系统：

```text
理解
↓
提取
↓
锁定事实
↓
去重
↓
判断意图
↓
设计信息层级
↓
匹配品牌
↓
生成视觉规范
↓
生成卡片
↓
生成交互
↓
生成运营话术
↓
自动 QA
↓
输出可编辑飞书卡片
```

最终不是一个单纯的“AI 卡片生成器”。

而是：

> **AI Card Design System + Content Compiler + Feishu Runtime + Operation Copilot**

---

# 23. 技术依据与参考

本 PRD 的飞书技术边界依据当前飞书开放平台公开能力设计，开发前仍需再次核对最新 Schema 与权限要求：

1. Feishu CardKit / 卡片搭建能力概览  
   https://open.feishu.cn/document/feishu-cards/feishu-card-cardkit/feishu-cardkit-overview

2. Card JSON 2.0 Structure  
   https://open.feishu.cn/document/feishu-cards/card-json-v2-structure

3. CardKit — Create Card Entity  
   https://open.feishu.cn/document/cardkit-v1/card/create

4. 飞书开发者社区已有交互式卡片实践展示了按钮回调、交互回传以及更新卡片等实现模式。正式开发应以开放平台最新 Server API 文档为准。

---

**PRD END**


---

# PRD 增补（v1.1）—— 图片承载信息与多按钮跳转能力

> 本增补用于强化一个关键原则：**图片不是装饰层，而是信息表达层。**
> 对于部分活动通知、课程预告、训练营排期、专题入口、优秀案例推荐等场景，
> “图片概括 + 少量关键文字 + 多个功能按钮”的表达效率可能高于纯文字卡片。

---

# A. 新增产品原则：Image as Information

## A.1 原则定义

在本产品中，图片的作用不只是“美观”或“装饰”，而是：

> **作为信息承载媒介，帮助用户更快理解复杂内容、形成记忆点，并缩短从阅读到点击的路径。**

因此系统必须具备如下判断能力：

- 什么信息更适合用文字直接表达
- 什么信息更适合压缩为可视化图片表达
- 什么信息适合用“图片 + 少量文字 + 按钮”的组合完成传达

---

## A.2 图片优先表达适用场景

以下场景优先考虑“图片承载信息”：

### 1）课程预告 / 培训预告
例如：
- 一周课程总览
- 多个系列并行开课
- 每周固定时段课程安排
- 课程亮点概括
- 不同主题专场入口

原因：
纯文字容易变成长列表，图片更适合概括结构与视觉分组。

---

### 2）活动主视觉通知
例如：
- 本周课程已就位
- AI先锋大赛新阶段开启
- 作品提交周提醒
- 决赛辅导开启
- 结果公布

原因：
主视觉图更容易形成“第一眼吸引 + 核心主题记忆”。

---

### 3）复杂信息摘要
例如：
- 多系列培训安排
- 两条时间线并行
- 模块功能亮点
- 多个场景说明
- 指南型内容

原因：
如果仅靠文字，容易产生文字墙；视觉模块化图片更便于扫读。

---

### 4）案例推荐 / 场景推荐
例如：
- 销售场景案例
- 客服场景案例
- 财务场景案例
- Agent 搭建参考案例

原因：
图片可以先概括价值点，按钮再提供深层跳转。

---

# B. 新增设计原则：图文关系

## B.1 图文分工原则

系统必须遵循：

### 图片负责
- 概括
- 视觉聚焦
- 分组
- 场景化理解
- 模块化信息压缩
- 品牌感建立
- 情绪氛围

### 文字负责
- 精确事实
- 时间
- 动作
- 截止
- 链接说明
- CTA 指令
- 不可误读的规则

换句话说：

> 图片适合帮助“看懂”，文字适合保证“看准”。

---

## B.2 图片不是海报堆砌

图片虽然承担信息传达，但不允许退化为“海报式大字图 + 一堆无用装饰”。

图片中的信息仍然必须遵循：

- 信息层级清晰
- 重点突出
- 扫读友好
- 模块分组明确
- 与按钮关系明确
- 手机端可读

---

## B.3 图片与卡片正文协同

推荐结构：

```text
Header（活动 / 品牌 / 日期状态）
↓
主视觉信息图（概括核心内容）
↓
关键 CTA 按钮
↓
少量补充说明
↓
次级功能按钮
```

不推荐：

```text
一大段文字
↓
一张装饰图片
↓
一堆无意义按钮
```

---

# C. 新增能力：Image Intent Router

在原有 Card Intent Router 之外，新增：

## Image Intent Router

系统要判断：

> 该内容是否应该生成信息型图片，而不是只生成文字卡片？

输出字段建议新增：

```json
{
  "image_mode": "required | recommended | optional | not_needed",
  "image_role": "hero_summary | schedule_overview | module_summary | scene_navigation | case_summary",
  "reason": "",
  "text_to_image_ratio": "70_30 | 50_50 | 30_70"
}
```

---

## C.1 触发条件

满足以下任意条件时，优先考虑图片承载信息：

- 存在多个并列模块
- 存在课程排期
- 存在多场景概括
- 存在多个入口页面
- 需要强主视觉吸引
- 文字版超过 6 个信息块
- 用户明确希望“像课程预告图那样”
- 同时存在多个按钮入口

---

# D. 新增功能需求

# D.1 FR-25 信息型图片生成

**优先级：P0**

系统应支持在卡片中自动生成或配置“信息型图片”策略。

支持两种模式：

### Mode A：卡片中直接嵌入信息图
图片本身已高度概括核心内容。

### Mode B：图片作为主视觉摘要，正文补充关键信息
用于兼顾视觉与事实准确性。

---

## D.1.1 图片中的可承载内容

允许在图片中承载的信息包括：

- 活动主题
- 系列名称
- 课程总览
- 模块亮点
- 分组信息
- 本周安排
- 场景分类
- 系列入口区分
- 轻量级时间结构
- 简要 slogan

但以下内容**不建议只放在图片里**，应同步在卡片正文或 CTA 附近保留：

- 精确截止时间
- 提交链接
- 会议入口
- 关键规则
- 高风险说明
- 强制行动项

---

# D.2 FR-26 图片信息抽象引擎

**优先级：P0**

在生成信息型图片前，系统必须将原始文案压缩为：

1. 图片一级标题
2. 图片二级说明
3. 模块分组
4. 每个模块 1～3 个核心要点
5. 关键数字 / 时间点
6. 对应按钮映射关系

例如课程预告：

```json
{
  "hero_title": "本周课程已就位！",
  "hero_subtitle": "从协作提效到 AI 实战",
  "modules": [
    {
      "title": "飞书直播大班课",
      "key_points": ["一周学会用飞书", "15:00-16:00", "周一到周五每天一课"]
    },
    {
      "title": "豆包工作系列",
      "key_points": ["豆包工作核心功能", "14:00-15:00", "分财务/销售/客服专场"]
    }
  ],
  "buttons": [
    {"label": "查看课程日历", "target": "calendar_page"}
  ]
}
```

---

# D.3 FR-27 图片提示词生成

**优先级：P0**

如果使用 AI 生成配图或信息图提示词，必须基于：

```text
Style.md
+ Card Intent
+ Image Intent
+ 信息结构
+ 模块内容
+ 组件布局
+ 平台阅读场景（移动端）
```

提示词必须强调：

- 图片承担信息传达
- 模块清晰
- 重点数字清楚
- CTA 位置预留
- 不做无关装饰
- 高级感 / 品牌一致性
- 飞书卡片场景适配
- 手机端可读

---

# D.4 FR-28 多按钮导航卡

**优先级：P0**

系统应支持“图片摘要 + 多按钮导航”的卡片形态。

适合：
- 课程预告
- 多专题培训
- 多场景案例
- 多入口导航
- 活动阶段入口

按钮可用于：

- 查看课程日历
- 预约直播
- 查看功能页
- 查看作品提交页
- 进入培训页
- 打开案例详情
- 联系负责人
- 查看系列内容
- 查看规则说明

---

## D.4.1 多按钮设计规则

- Primary CTA ≤ 1
- Secondary CTA ≤ 4（手机端建议 2～4）
- 按钮必须按优先级排序
- 文案必须是动作导向
- 同一排按钮不应过多导致拥挤
- 多按钮场景优先网格布局或分组布局
- 每个按钮必须与图片中的某个模块形成清晰对应关系

---

## D.4.2 跳转类型

需支持：

- URL 跳转
- 飞书文档
- 飞书多维表格
- 飞书会议 / 日历
- 卡片内部交互回调
- 业务功能页
- 外部活动页

---

# D.5 FR-29 图片与按钮联动映射

**优先级：P1**

若一张图片中包含多个模块，例如：

- 周三：财务专场
- 周四：销售专场
- 周五：客服专场

则系统应优先生成与模块对应的按钮：

- 周三：财务专场
- 周四：销售专场
- 周五：客服专场

并保证用户能够从“看到模块”直接点击对应入口。

---

# D.6 FR-30 参考图风格适配

**优先级：P1**

产品需要支持基于参考案例总结一种“低文案、高概括、强主视觉、多入口”的卡片风格。

该风格特征包括：

- 标题简洁
- 重点文案非常少
- 图片承担主要概括职责
- 大面积留白
- 模块化信息块
- 明显的按钮区
- 清晰的入口区分
- 轻量渐变背景
- 友好的卡片容器
- 整体高级、清晰、偏产品化而不是海报化

注意：

此处参考的是**信息组织方式**，不是照搬某一张现成卡片。

---

# E. 新增模板类型

在模板库中补充：

```text
templates/
├── image_hero_summary
├── image_schedule_overview
├── image_multi_entry
├── image_case_navigation
└── image_training_digest
```

---

## E.1 image_schedule_overview

适合：
- 每周课程表
- 培训排期
- 系列直播

结构：

```text
Header
↓
课程预告信息图
↓
查看课程日历（Primary）
↓
分专题按钮（Secondary）
```

---

## E.2 image_multi_entry

适合：
- 多专题场景
- 多功能入口
- 多模块推荐

结构：

```text
Header
↓
主视觉信息图
↓
主入口按钮
↓
分模块按钮区
↓
补充说明
```

---

# F. 新增视觉要求

## F.1 信息图视觉要求

信息型图片必须具备：

- 标题可扫读
- 模块分区明显
- 数字与时间清晰
- 图标辅助理解
- 视觉节奏明确
- 不拥挤
- 不堆砌噱头
- 对比度充足
- 适合飞书移动端阅读

---

## F.2 信息图不要犯的错

禁止：

- 只有氛围没有信息
- 背景复杂影响阅读
- 装饰元素过多
- 字太小
- 所有模块一模一样重
- 图片里放太长段落
- 图片承担所有精确信息导致无法点击操作
- 按钮和图中模块没有对应关系

---

# G. 新增 QA

# G.1 Image QA

生成带图片卡片时必须检查：

- [ ] 图片是否承担了真实信息传达作用
- [ ] 图片是否比纯文字更高效
- [ ] 图片中的标题是否清晰
- [ ] 图片中的模块是否分组明确
- [ ] 手机端是否可读
- [ ] 是否存在无意义装饰
- [ ] 图片与按钮是否存在明确映射关系
- [ ] 关键事实是否仍在正文或 CTA 处得到准确承接
- [ ] 图片是否符合 style.md
- [ ] 图片是否强化而不是削弱了行动路径

---

# G.2 Navigation QA

对于多按钮导航卡，需新增检查：

- [ ] 主按钮是否明确
- [ ] 次级按钮是否不超过合理上限
- [ ] 按钮之间无语义重复
- [ ] 按钮优先级清楚
- [ ] 每个按钮跳转目标正确
- [ ] 是否避免“看图不知道点哪里”

---

# H. 新增成功指标

增加以下指标：

## 图片信息效率
- 图片版卡片主信息识别效率高于纯文字版
- 用户能更快理解“有哪些内容可看”
- 群内重复追问下降

## 导航效率
- 多按钮卡片的有效点击率提升
- 课程类 / 培训类内容的进入率提升
- 从卡片到目标页的转化率提升

---

# I. 新的设计结论

本产品的卡片生成逻辑应从：

> “根据文案生成好看的卡片”

升级为：

> **根据信息特征，智能选择“文字优先”还是“图片优先”，并通过按钮把理解路径直接连到行动路径。**

因此在最终产品层面需要形成三类输出能力：

1. **Text-first Card**  
   适合 deadline、submission、纯提醒类

2. **Image-assisted Card**  
   图片概括 + 正文承接  
   适合通知、培训、案例推荐

3. **Image-led Navigation Card**  
   图片承担核心概括 + 多按钮入口  
   适合课程预告、系列导航、多模块推荐

---

# J. 实施建议（对开发）

开发实现上，建议把渲染策略抽象为：

```json
{
  "render_mode": "text_first | image_assisted | image_led_navigation",
  "cta_mode": "single | multi",
  "image_required": true,
  "button_count": 3
}
```

在卡片编译阶段先确定 render mode，再决定：

- 是否生成信息图
- 图片占比
- 正文字数
- 按钮数量
- 布局结构
- 是否适配多入口导航

---

# K. 与飞书能力的对应关系（产品约束）

从飞书公开能力来看，卡片体系具备 Card JSON 2.0、图片组件、按钮组件、整体卡片跳转、卡片实体创建与后续更新等能力，因此“信息图 + 少量文字 + 多按钮跳转”的模式在产品上是成立的，后续实现时应继续以飞书开放平台最新文档为准。

---

**v1.1 增补 END**


---

# PRD v1.2 增补 —— Mobile First 手机端专项适配

## 24. 新增最高优先级原则：Mobile First

AI先锋大赛卡片的默认设计目标设备不是电脑，而是：

> **飞书手机端。**

大量活动通知、培训提醒、作品提交、群运营信息都会首先在手机聊天流中被看到，因此所有卡片必须先保证手机端成立，再扩展桌面端。

产品设计优先级更新为：

```text
事实准确
> 手机端信息传达效率
> 行动效率
> 信息层级
> 跨端一致性
> 品牌一致性
> 桌面端扩展
> 美观
```

如果桌面端效果与手机端效果发生冲突：

> **手机端优先。**

---

## 25. Mobile First 核心目标

### G6：手机端 3 秒识别

用户在手机聊天流中看到卡片后，3 秒内必须知道：

- 这是什么活动
- 当前最重要的信息是什么

### G7：手机端 5 秒行动

5 秒内必须知道：

- 是否和自己有关
- 什么时候做
- 应该点击哪个入口

### G8：避免缩放阅读

手机端不得要求用户：

- 放大图片才能看字
- 横向滚动
- 在密集双栏中寻找信息
- 阅读超长段落
- 猜测哪个按钮对应哪个模块

---

# 26. FR-31 Mobile Layout Engine

**优先级：P0**

所有卡片生成后必须经过一次独立的：

```text
Mobile Layout Pass
```

该阶段不是简单缩小桌面布局，而是重新判断手机端的信息结构。

输入：

```text
Card Structure
+ Render Mode
+ Image Plan
+ CTA Plan
```

输出：

```json
{
  "mobile_priority": true,
  "reading_order": [],
  "column_strategy": "single | limited_two_column",
  "button_strategy": "stacked | two_column_short_labels",
  "image_strategy": "",
  "fold_priority": [],
  "mobile_warnings": []
}
```

---

## 26.1 手机端默认单列

默认使用：

```text
Single Column
```

不允许依赖桌面端的宽屏双栏才能理解。

只有满足以下条件时才允许手机端使用有限双列：

- 两个模块高度对称
- 每个模块文字极少
- 按钮文字很短
- 手机上无需缩小字号
- 阅读顺序不存在歧义

禁止：

```text
3 列以上正文
4 列信息模块
超宽表格
依赖横向阅读的复杂时间线
```

---

# 27. FR-32 Mobile Reading Order

**优先级：P0**

手机阅读方式以：

```text
Top → Bottom
```

为核心。

系统必须明确移动端阅读顺序：

```text
1. Brand / Event
2. Primary Anchor
3. Critical Time / Status
4. Hero / Information Image
5. Primary CTA
6. Secondary Information
7. Secondary CTA
8. Footer / Note
```

不得因桌面端视觉排版造成手机端顺序错乱。

---

# 28. FR-33 Mobile CTA Strategy

**优先级：P0**

手机端按钮必须优先：

```text
大、短、清楚、可点击
```

默认：

- Primary CTA 独占一行
- Secondary CTA 优先纵向排列
- 当 Secondary 文案都很短时，最多允许 2 个并排
- 不允许 3～4 个小按钮挤在一行
- 不允许使用需要精确点击的小型文字链接替代主要 CTA

例如：

```text
[提交作品]

[查看规则]
[查看优秀案例]
```

而不是：

```text
[提交] [规则] [案例] [课程]
```

---

# 29. FR-34 Mobile Image Strategy

**优先级：P0**

图片必须为手机端重新评估。

## 29.1 Hero Image

如果主要承担氛围与主题：

可使用较宽横图。

## 29.2 Information Image

如果图片本身承担较多信息：

必须避免过宽比例导致手机端字体缩小。

应优先考虑：

- 更高的纵向占比
- 更少的模块
- 更大的核心数字
- 更大的文本
- 分段式信息图

核心规则：

> 如果一张图片缩到手机卡片宽度后需要放大才能读，就判定失败。

---

## 29.3 图片文字降级规则

如果信息图中文字过密：

```text
Image Text
→ Reduce
→ Move Critical Facts to Native Card Text
```

AI 不得为了保持图片“完整”而牺牲手机可读性。

---

# 30. FR-35 Above-the-Fold Priority

**优先级：P1**

手机首屏优先出现：

```text
活动身份
+
第一视觉重点
+
关键时间 / 当前状态
+
Primary CTA（尽可能）
```

长篇背景、完整规则、次级说明放到后面或通过按钮跳转。

目标：

> 用户不需要滑动很久才能找到“我要做什么”。

---

# 31. FR-36 Cross-device Link Strategy

**优先级：P1**

涉及跳转时：

1. 优先使用可在飞书移动端直接打开的链接
2. 优先使用飞书内部页面 / H5 / 移动端友好页面
3. 如果当前官方 Card Schema 支持针对不同客户端配置差异化跳转，则允许配置移动端和桌面端不同目标
4. 如果不支持，则使用经过手机验证的通用链接
5. 不得生成只在桌面端正常打开的 Primary CTA

任何跳转必须验证：

```text
iOS
Android
Desktop
```

至少确认目标页在移动端可用。

---

# 32. FR-37 Mobile Progressive Disclosure

**优先级：P0**

手机端更加严格执行：

```text
L1 即看
L2 滑动
L3 点击
```

### L1
必须放在卡片上：

- 当前任务
- 截止
- 时间
- Primary CTA

### L2
允许继续往下看：

- 简要说明
- 关键注意事项

### L3
通过按钮跳转：

- 完整规则
- 详细课程表
- 长案例
- 完整操作手册

---

# 33. FR-38 Mobile Interaction Density

**优先级：P1**

单张手机卡片不应同时要求用户做太多事情。

建议：

```text
Primary Action = 1
Secondary Action = 0~3
```

如果超过：

优先：

```text
导航页 / 课程页 / 多维表
```

而不是继续堆按钮。

---

# 34. 新增 Mobile QA

发布前必须检查：

- [ ] 手机上的第一视觉重点是否清楚
- [ ] 是否默认单列阅读
- [ ] 是否存在 3 列以上内容
- [ ] 是否需要横向滚动
- [ ] 图片中文字是否无需放大即可读
- [ ] Primary CTA 是否明显
- [ ] 是否存在一行按钮过多
- [ ] CTA 跳转页是否支持手机访问
- [ ] 关键 Deadline 是否无需滑动很久即可看到
- [ ] 信息图是否在手机端仍能承担信息
- [ ] 长内容是否通过 Progressive Disclosure 处理
- [ ] iOS / Android Preview 是否完成
- [ ] Desktop 变化是否没有破坏 Mobile Reading Order

任何 P0 项失败：

```text
禁止发布
```

---

# 35. 新增 Mobile 验收标准

### AC-14
所有模板必须有 Mobile Preview。

### AC-15
手机端不得依赖横向滚动理解核心内容。

### AC-16
核心正文不得使用 3 列以上布局。

### AC-17
图片内核心文字在手机宽度下无需放大。

### AC-18
Primary CTA 手机端必须明显且可独立点击。

### AC-19
多按钮场景默认不得 3 个以上并排。

### AC-20
关键 Deadline 与行动项必须在移动端原生文本中可读取。

### AC-21
Primary CTA 跳转目标必须完成移动端可用性检查。

### AC-22
同一张卡片的手机阅读顺序必须符合信息优先级，而不是桌面布局顺序。

---

# 36. 新增 Mobile 成功指标

后续建议增加：

- Mobile CTA CTR
- Mobile Card Completion Rate
- Mobile-to-target-page Conversion
- Mobile Repeat-question Rate
- Mobile First-screen Recognition Rate

重点反向指标：

> 如果用户在手机端看完卡片后仍然问“在哪点”“什么时候截止”“手机打不开吗”，则卡片设计失败。

---

# 37. 产品设计结论升级

本产品最终不是：

```text
Desktop Card → 缩小到 Mobile
```

而是：

```text
Mobile Information Architecture
→ Mobile Card
→ Desktop Enhancement
```

手机端是基线，不是兼容项。
