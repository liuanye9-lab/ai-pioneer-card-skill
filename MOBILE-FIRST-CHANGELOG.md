# v1.2 Mobile First Changelog

本次升级将“手机端适配”从 DESIGN 中的一般原则提升为全链路 P0 能力。

## PRD
- Mobile First 成为最高优先级产品原则
- 新增 FR-31 ~ FR-38
- 新增 Mobile QA
- 新增 AC-14 ~ AC-22
- 新增移动端成功指标

## SPEC
- 新增 Mobile Layout Pass
- 新增 DeviceProfile / MobileLayoutPlan
- 新增移动端按钮、图片、列布局规则
- 新增 Deep Link Resolver
- 新增 CrossDeviceQARunner
- 新增 iOS / Android / Desktop Test Matrix
- 新增 Mobile Golden Tests

## DESIGN
- 明确 Single-column Vertical Scan
- 手机首屏优先级
- 手机按钮策略
- 信息图比例与模块密度
- Vertical Timeline
- Mobile Fold / Accessibility / Link Destination

## SKILL
- Mobile Pass 进入强制执行流程
- Mobile Image Readability 作为 Hard Gate
- Mobile CTA / Column / Fold / Link Rule
- Mobile Fail = Final Fail

## 2026-08-30 — 质量升级（多 Agent 审核修复）

围绕事实安全、防大段文字、真图片、视觉强调等做的一轮质量收敛。

- **事实安全加固**：`normalizeDatesInText` 增加日期上下文门控 + 负向单位/前缀护栏 + 全角折叠，非日期数字（8.9万元 / 第8.15条 / 会议室0809 / 价格8.9元 / 9.9折）不再被误改成日期；同一护栏也加到 `extractDates`。新增 QA 检查 `FACT_CORRUPTED_AS_DATE`（hard_fail）。
- **防大段文字**：`information-qa` 的 TEXT_WALL 对任意正文块 >90 字硬失败（>50 字软告警），并检查所有块形态；管线 `remediate()` 会拆分超长块。新增 `INLINE_URL_IN_BODY` 检查。奖励文案拆成独立 emoji 前缀行（奖金 vs 证书），正文内联 URL 被剥离（改由按钮承载）；`extractByHints` 从事实值里剥掉 URL 及其引导语。
- **可插拔真图片生成**：新增 `src/design/image-generator.ts`（双模式：`IMAGE_API_URL`/`IMAGE_API_KEY` 走运行时文生图端点，否则 delegate 给宿主图片能力）。`cardkit-client` 新增 `uploadImageBytes` / `uploadImageFromUrl` 换取 img_key。tool-adapter 新增异步 `generateFeishuCardWithImage`（通过 `generate_feishu_card` 的 `with_image` 参数选择开启）。任何失败都优雅降级为原生文字。
- **视觉强调**：截止/日期用 `<font color="red">**...**</font>` 高亮（不只是加粗），时间轴截止节点高亮；header 从上传的 logo img_key 输出 `icon`，副标题填充；emoji 按语义出现在关键块（锚点/奖励/日期），不强制每段都加，避免堆砌。
- **少文字优先图片+按钮**：反大段文字的核心手段是「用生图承载信息 + 按钮承载交互」，而非给每行加 emoji；文字墙仍由 TEXT_WALL 硬门禁 + 拆分兜底。
- **时间轴加固**：节点状态按日期感知（done/current/upcoming 相对今天）；action→date 按邻近度匹配；截止节点标注「截止」；意图路由对「3+ 日期 + 日程词」果断路由到 timeline；截止提取把「截止」与其最近的前置日期配对（不再取第一个）。
- **按钮**：通用流程把每个未使用的真实链接映射成次级跳转按钮（动词+宾语标签），按 URL 去重（同一目的地不出两个按钮）。
- **运营话术**：按活动名个性化；新增可选的活跃 群气氛 变体 `beforeSendLively`（感叹式，如「朋友们，AI先锋大赛 作品提交通道开啦！…」）。
- **去重 + Emoji**：语义去重折叠中文数字（一万↔10000）+ 同义词（冠军↔第一名），在共享数字+奖励/地点时加权；emoji shortcode 白名单扩到约 40 条（含 礼花🎉 鼓掌👏 火箭🚀 证书🎖️）。
- **测试**：99 → 113（新增并持续补强 `tests/quality-upgrade-2026-08-30.test.ts`），全部通过。
