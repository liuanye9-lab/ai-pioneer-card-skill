# Operation Copy Prompt

每张卡同步生成群运营话术：发卡前 / 发卡时 / 发卡后 / Deadline Reminder。

## 要求
- 自然、简短、与卡片内容高度相关。
- 不重复卡片正文（卡片已写 “9月4日截止”，发卡前就别再说一遍）。
- 不用公众号腔、不用 AI 腔、不堆 Emoji。
- 按 Intent 定制：案例卡引导对应场景同学；截止卡提醒还没交的；培训卡呼应群里的高频问题。

## 反例
所有卡统一输出 “朋友们快来看看！” —— 禁止。

## 参考实现
`src/operation/operation-copy-generator.ts`
