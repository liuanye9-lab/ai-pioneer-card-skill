# AI先锋大赛智能飞书卡片 Skill — DESIGN

**版本**：v1.2  
**定位**：视觉系统 + 信息设计 + 交互设计规范  
**设计原则**：信息效率第一，视觉用于强化理解，图片用于承载信息，按钮用于完成行动。

---

# 1. 设计目标

这套系统不是生成“漂亮海报”。

它生成的是：

> **在飞书聊天流中，5 秒内可以看懂、可以点击、可以行动的活动信息界面。**

设计优先级：

```text
信息清晰
> 时间 / 行动可识别
> 可点击
> 品牌统一
> 高级感
> 装饰性
```

---

# 2. 母设计语言

默认视觉：

> **Premium AI × Feishu Native × iOS Editorial**

关键词：

- 清晰
- 克制
- 高级
- 通透
- 精致
- 低饱和
- 微渐变
- 大留白
- 模块化
- 原生产品感
- 信息导向

避免：

- 赛博朋克
- 电竞感
- 廉价科技蓝
- 过度发光
- 满屏渐变
- 过度 3D
- PPT 模板感
- 文字海报感

---

# 3. 第一性原理：注意力必须可设计

每张卡只有一个第一视觉中心。

### Primary Anchor
只允许 1 个。

例如：

- 9月4日截止
- 本周课程已就位
- 初赛作品提交
- 决赛名单公布

### Secondary Anchors
建议 2～3 个。

例如：

- 具体任务
- 课程主题
- 状态
- CTA

其余全部降级。

---

# 4. 三种渲染模式

# 4.1 Text First

适合：

- Deadline
- Submission
- Short Reminder

视觉结构：

```text
Header
↓
超明显关键时间 / 动作
↓
1～2 行说明
↓
Primary Button
```

文字占比：

```text
70%
```

图片：

```text
0～20%
```

---

# 4.2 Image Assisted

适合：

- 培训通知
- 案例推荐
- 活动阶段通知

结构：

```text
Header
↓
Hero / Summary Image
↓
核心事实
↓
Primary CTA
↓
轻量补充
```

建议：

```text
Image 50%
Text 50%
```

---

# 4.3 Image Led Navigation

适合：

- 多课程
- 多系列
- 多专题
- 多入口
- 活动导航

结构：

```text
Header
↓
信息型主视觉
↓
Primary CTA
↓
Secondary CTA Grid
```

建议：

```text
Image 70%
Text 30%
```

这就是参考图中最值得吸收的思路：

> 正文极少，把课程结构、系列差异、时间安排等压缩进视觉模块；按钮负责直接进入下一步。

---

# 5. 图片不是装饰

图片必须至少承担一种职责：

- 核心主题概括
- 课程结构概括
- 时间结构概括
- 模块分组
- 多系列对比
- 场景导航
- 案例理解
- 品牌识别

如果删除图片后信息完全不受影响，则该图片大概率只是装饰。

---

# 6. 图片中什么能放，什么不能只放

## 可以主要放在图片里

- Hero Title
- 系列名称
- 课程主题
- 模块名称
- 场景分类
- 周计划概览
- 轻量时间段
- 卖点
- 视觉化步骤

## 不允许只存在图片里

- 精确截止日期
- 关键提交时间
- 核心 CTA
- 真实跳转 URL
- 高风险规则
- 必须完成的动作
- 关键联系人

原因：

图片可读性、无障碍、编辑性、搜索性都低于原生文本。

---

# 7. 图片排版

推荐：

```text
[Hero Headline]

[Short Subtitle]

[Module A]   [Module B]

[Time / Key Number]

[Visual Illustration / Brand Element]
```

要求：

- 一级标题 1 个
- 二级说明最多 1～2 行
- 单模块不超过 3 个要点
- 图片内不要出现长段落
- 重要数字尺寸明显大于解释文字
- 手机端缩放后仍可读

---

# 8. 卡片 Header

推荐结构：

```text
[Logo] AI先锋大赛         [8月25日 · 今日]

PIONEER ROADMAP · 作品交付
```

视觉：

- Logo 左对齐
- 活动名最高品牌权重
- 日期 Badge 轻量
- Subtitle 拉开层级
- 背景使用微渐变
- 避免粗重边框

---

# 9. Typography

建议层级：

```text
Display / Hero: 26–32
H1: 20–24
H2: 16–18
Body: 14–16
Caption: 12–13
```

飞书卡片最终受组件能力限制时：

重点遵循**相对层级**，不要硬追绝对字号。

日期 / 数字：

- 允许使用更高 Weight
- 适合更强对比
- 不建议使用花体

---

# 10. 字体原则

中文：

- 系统无衬线
- 飞书原生风格优先
- 视觉图中允许使用现代黑体

英文：

- 中性无衬线
- 字距略松可用于副标题

禁止：

- 多字体混搭
- 过度艺术字体
- 影响中文识别的字体

---

# 11. Color System

默认不是固定 Hex，而是语义层。

```text
Primary Brand
Primary Text
Secondary Text
Muted Text
Surface
Elevated Surface
Accent
Success
Warning
Danger
Divider
```

AI先锋大赛默认倾向：

- 冷白
- 银灰
- 柔和蓝
- 青蓝
- 极轻紫
- 少量品牌绿 / 蓝作为点缀

要求：

- 大面积低饱和
- 高饱和只用于 CTA / 状态 / 关键时间
- 一张卡主强调色不超过 2 种

---

# 12. Gradient

允许：

- 蓝 → 青
- 蓝 → 紫
- 银灰 → 冷白
- 极弱动态渐变感

禁止：

- 5 色彩虹
- 高饱和霓虹
- 大面积彩色渐变文字
- 渐变盖住正文

---

# 13. Spacing

使用 4pt / 8pt 思路：

```text
4
8
12
16
24
32
```

原则：

- 模块内紧
- 模块间松
- 第一视觉周围留白最多
- CTA 前后留出空间

---

# 14. Radius

视觉图与自定义容器：

```text
Small: 8
Medium: 12
Large: 16
Hero: 20
```

飞书原生组件若无法自定义，服从原生。

---

# 15. Border

默认：

- 极细
- 低对比
- 只用于分组

避免：

- 深色硬边框
- 每个模块都框起来
- 表格感过强

---

# 16. Shadow

默认：

- 轻
- 扩散大
- 透明度低

只用于：

- Hero
- 重点模块
- 信息图中的轻层次

---

# 17. Badge

适合：

- 今日
- 进行中
- 截止
- 已完成
- 直播
- 推荐
- 新增

规则：

- Badge 是状态，不是句子
- 不超过 4～6 字
- 不堆多个 Badge

---

# 18. Timeline

时间线必须优先表达：

```text
WHEN → WHAT
```

而不是：

```text
一段解释 → 一段解释 → 日期
```

状态：

```text
✓ 已完成
● 进行中
○ 待开始
```

当前节点：

视觉权重最高。

---

# 19. Deadline

截止卡：

第一视觉必须是：

```text
9月4日
```

或：

```text
9月4日 · 截止
```

其次：

```text
提交初赛作品
```

第三：

```text
提交要求 / 按钮
```

---

# 20. Training

培训卡：

```text
培训主题
↓
时间
↓
核心收获
↓
预约 / 进入培训
```

如果多场培训：

优先切到 Image Led Navigation。

---

# 21. Submission

```text
提交什么
↓
什么时候截止
↓
最低提交要求
↓
提交按钮
```

不要把完整比赛规则塞进提交卡。

---

# 22. Case Showcase

结构：

```text
场景
↓
解决了什么
↓
亮点
↓
查看案例
```

若多个案例：

使用：

```text
Image Multi-entry
```

---

# 23. Button Design

按钮必须是动作。

正确：

- 提交作品
- 查看规则
- 进入培训
- 查看课程日历
- 查看案例
- 打开作品
- 联系负责人

错误：

- 点这里
- 更多
- 详情
- 链接

---

# 24. 多按钮导航

推荐：

```text
[Primary CTA]

[财务专场] [销售专场]
[客服专场] [查看课程表]
```

原则：

- 最重要动作独占一层
- 其他入口成网格
- 文案短
- 不超过 4 个 Secondary
- 图中模块与按钮语言一致

---

# 25. 图片与按钮关系

例如图片中：

```text
财务专场
销售专场
客服专场
```

卡片按钮就应对应：

```text
[财务专场]
[销售专场]
[客服专场]
```

不要出现：

图片：

```text
财务 / 销售 / 客服
```

按钮：

```text
了解更多
查看更多
点击进入
```

信息映射必须直接。

---

# 26. 参考图可吸收的设计规律

参考图最重要的不是色彩，而是：

1. **大图负责概括课程结构**
2. **正文压缩到极少**
3. **按钮承担入口**
4. **系列内容视觉上分栏**
5. **时间被视觉化**
6. **模块彼此独立，扫读效率高**
7. **用户看完后可以直接操作**

Skill 应学习这种结构逻辑，而不是机械复刻。

---

# 27. Brand Adaptation

当存在企业品牌时：

```text
AI先锋大赛母设计系统
×
客户品牌 DNA
```

例如东方生活方式品牌：

可转为：

```text
Modern Oriental
×
Water
×
Soft Ink
×
Minimal
×
Digital AI
```

但信息层级规则不变。

---

# 28. style.md 推荐结构

```md
# Brand Identity
# Keywords
# Visual Direction
# Color System
# Typography
# Gradient
# Radius
# Spacing
# Border
# Shadow
# Icon
# Emoji
# Image
# Illustration
# Motion
# Header
# Button
# Timeline
# Badge
# Do
# Don't
```

---

# 29. Motion

如果使用 GIF / Video / 动态素材：

允许：

- subtle gradient drift
- soft shimmer
- breathing highlight
- slow particle

禁止：

- 快速闪烁
- 大范围移动
- 过度粒子
- 影响文字识别

Motion 的职责：

```text
引导注意力
```

不是：

```text
炫技
```

---

# 30. Accessibility

必须考虑：

- 文字对比度
- 图片内文字大小
- 颜色不作为唯一状态标识
- 重要信息有文本版本
- Button label 可理解
- 图片需有语义性 alt 描述（若平台支持）

---

# 31. Mobile First

卡片主要使用场景是飞书聊天流。

因此默认：

> Mobile First

检查：

- 不出现超宽表格
- 不出现 5 列按钮
- 不出现极小文本
- 不依赖 hover
- 图片信息压缩后仍可读
- 视觉层级从上到下成立

---

# 32. Desktop Adaptation

桌面端允许：

- 2 列内容
- 更宽图片
- 更舒展按钮

但不能牺牲移动端。

---

# 33. Operation Copy 视觉协同

发卡前群话术不要重复卡片。

例如卡片已经写：

```text
9月4日截止
```

发卡前可以说：

```text
还没交初赛作品的同学重点看一下这张卡，今天先把可提交版本准备好。
```

而不是：

```text
9月4日截止，大家9月4日前提交。
```

---

# 34. 设计 QA

每张卡最终检查：

### Attention
- 第一眼看到的是不是最重要的信息？

### Density
- 有没有文字墙？

### Image
- 图片是不是在传递信息？

### CTA
- 看完后是否知道下一步？

### Brand
- 是否属于同一套活动视觉？

### Mobile
- 手机端是否清楚？

---

# 35. 评分

```text
Information Clarity 30
Attention Hierarchy 20
Action Clarity 15
Brand Consistency 15
Visual Quality 10
Feishu Native Experience 10
```

< 85：

重新设计。

---

# 36. 最终设计判断公式

每次生成前：

```text
用户最需要知道什么？
↓
哪些必须精确？
↓
哪些适合视觉化？
↓
哪些适合图片概括？
↓
哪些必须点击完成？
↓
如何在 5 秒内完成理解？
```

系统永远不要从：

```text
“选哪个模板？”
```

开始。

而应该从：

```text
“这张卡要完成什么认知任务？”
```

开始。

---

**DESIGN END**


---

# 38. Mobile First Design System

手机端不是缩小版桌面端。

本系统的设计顺序必须是：

```text
Mobile
→ Tablet / Wide Mobile
→ Desktop
```

任何设计先在手机宽度下成立，再考虑桌面端扩展。

---

# 39. 手机端信息结构

默认：

```text
Single-column Vertical Scan
```

建议顺序：

```text
Brand / Activity
↓
Primary Anchor
↓
Critical Time / Status
↓
Hero / Information Image
↓
Primary CTA
↓
Secondary Info
↓
Secondary CTA
```

用户不应该左右寻找内容。

---

# 40. 手机首屏策略

尽可能让首屏完成：

```text
我看到什么？
+
现在最重要的是什么？
+
我要点哪里？
```

优先展示：

- 活动名
- 核心时间
- 当前节点
- Primary CTA

弱化：

- 活动背景
- 长解释
- 完整规则
- 次级品牌叙事

---

# 41. 手机端列布局

### 默认

```text
1 Column
```

### 允许 2 Column

仅适合：

- 两个短按钮
- 两个高度对称的短模块
- 两个短 Badge / 状态
- 对比型极简内容

### 禁止

- 3～4 列正文
- 小字号四宫格长文案
- 多层嵌套列
- 必须横向阅读的时间线

---

# 42. 手机按钮

Primary CTA：

```text
优先独占一行
```

Secondary：

```text
1 个 → 独占
2 个短文案 → 可并排
3～4 个 → 纵向 / 2+2
```

长按钮文案：

```text
不要强行并排
```

---

# 43. 手机图片

## Hero Image

图片主要负责氛围：

可横向。

## Information Image

图片承担大量信息：

优先提高纵向空间，不要做成超宽小字横图。

建议：

```text
4:3
1:1
3:4
```

具体比例根据内容判断。

---

# 44. 图片移动端可读性

任何信息型图片都要进行一个判断：

> 把图片缩到真实手机卡片宽度，我还能不能不放大直接读？

如果不能：

必须：

- 减少文字
- 放大数字
- 减少模块
- 拆成两张图
- 将关键事实移回飞书原生文本

---

# 45. 手机端图片模块数量

建议：

```text
2～4 个主模块
```

超过 4 个：

优先：

- 分两屏
- 拆图
- 提供课程日历按钮
- 进入详情页

不要为了“一张图放完”而把字缩小。

---

# 46. 手机端 Typography

核心原则：

> 不依赖极小字号建立信息密度。

信息密度应该通过：

- 去重
- 分组
- Progressive Disclosure
- 图形化
- 按钮跳转

解决，而不是缩小字。

---

# 47. 手机端 Timeline

优先：

```text
Vertical Timeline
```

不推荐：

```text
Horizontal Timeline
```

原因：

纵向更符合手机扫描方式，也更容易处理节点数量增长。

每个节点：

```text
日期
任务
状态
```

辅助说明最多 1～2 行。

---

# 48. 手机端 Deadline

结构非常短：

```text
AI先锋大赛

9月4日
作品提交截止

[提交作品]

简短说明
```

不要把 Deadline 卡变成长通知。

---

# 49. 手机端 Training

单场培训：

```text
培训主题
时间
图片
[预约直播]
```

多场培训：

```text
信息图概括
+
查看完整课程日历
+
少量专题按钮
```

不要把完整课程表都用小字塞在图片里。

---

# 50. 手机端 Image-led Navigation

参考结构：

```text
[Header]

[本周课程已就位]
[信息图：两个系列]

[查看课程日历]

[财务专场] [销售专场]
[客服专场]
```

这比：

```text
两列超密课程表 + 5 个小按钮
```

更适合手机。

---

# 51. Mobile Fold

重要信息尽量出现在第一次滑动之前。

如果 Card 很长：

优先裁剪：

1. 重复文案
2. 次要说明
3. 背景介绍
4. 次级视觉

永远不要先裁剪：

- Deadline
- Action
- CTA

---

# 52. Mobile Link Destination

按钮点开后的页面也必须是移动端友好的。

禁止：

- Primary CTA 跳到只适合桌面的宽表格页面
- 手机打开后必须缩放才能操作
- 跳转后找不到真正的提交按钮

卡片设计不能只优化“点之前”。

---

# 53. Mobile Accessibility

必须：

- 高对比度
- 不只用颜色表达状态
- 图片文字够大
- 按钮语义明确
- 重要内容有原生文本
- 不把关键信息只放在图里

---

# 54. Cross-device Principle

桌面端允许增加：

- 双列
- 横向空间
- 更大的 Hero
- 更舒展的 Secondary CTA

但桌面增强不得改变：

- 事实顺序
- 主要行动
- Mobile Reading Order
- Primary Anchor

---

# 55. Mobile QA 设计检查

每张卡发布前问：

1. 手机第一眼看到什么？
2. 这个东西是不是最重要的？
3. 不放大图片能看懂吗？
4. 我要点哪里清楚吗？
5. 有无横向滚动？
6. 是否存在 3 列以上信息？
7. 是否把桌面双栏硬塞到手机？
8. Deadline 是否太靠后？
9. 按钮是否太密？
10. 跳转页在手机是否真的能用？

有一个核心问题回答“不”：

重新设计。

