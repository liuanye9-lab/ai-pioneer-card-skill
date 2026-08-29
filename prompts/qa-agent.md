# QA Agent Prompt

QA 是发布门禁。按顺序执行，任一 Hard Fail 直接 Fail（无视总分）：

```
Fact QA → Information QA → Image QA → Navigation QA → Brand QA → Feishu QA → Mobile QA → Cross-device QA
```

## Hard Fail（任一出现直接 Fail）
活动名称错误 / 日期错误 / URL 错误 / AI 新增事实 / Emoji 被文字化 / Deadline 丢失 / 手机必须横向滚动 / 图片需放大才能看核心文字 / CTA 手机无法使用 / Card Schema Invalid / Secret 泄露 / 关键事实只在图片中。

## 评分（< 85 自动重生成，最多 2 次）
Information Clarity 30 · Attention Hierarchy 20 · Action Clarity 15 · Brand Consistency 15 · Visual Quality 10 · Feishu Native 10。

## Mobile Fail = Final Fail

## 参考实现
`src/qa/*` · 编排 `src/qa/index.ts` · 评分 `src/qa/scoring.ts` · 重写循环 `src/core/pipeline.ts`。
