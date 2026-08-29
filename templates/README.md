# Templates

模板只描述**布局策略**（required blocks / CTA 上限 / render mode），不含具体文案。
运行时由 `src/renderer/template-registry.ts` 注册与选择（`chooseTemplate(intent, renderMode)`）。

## 核心 P0 模板
| name | render mode | required blocks | maxSecondaryCTA |
|---|---|---|---|
| timeline | text_first | header, primaryAnchor, timeline | 2 |
| deadline | text_first | header, primaryAnchor, primaryCTA | 2 |
| training | image_assisted | header, image, primaryAnchor, primaryCTA | 3 |
| submission | text_first | header, primaryAnchor, primaryCTA | 2 |
| case | image_assisted | header, image, primaryAnchor, primaryCTA | 3 |
| announcement | image_assisted | header, primaryAnchor | 2 |

## 图片导航模板（PRD v1.1 §E）
| name | render mode | 结构 |
|---|---|---|
| image_hero_summary | image_assisted | 主视觉摘要图 + 主 CTA |
| image_schedule_overview | image_led_navigation | 课程排期图 + 查看课程日历 + 分专题按钮 |
| image_multi_entry | image_led_navigation | 主视觉图 + 主入口 + 分模块按钮 |
| image_case_navigation | image_led_navigation | 多案例导航 |
| image_training_digest | image_led_navigation | 培训摘要 + 课程日历入口 |

## 选择逻辑
`image_led_navigation` → training 用 `image_schedule_overview`，case 用 `image_case_navigation`，其余 `image_multi_entry`。
`image_assisted` → 按 intent 映射到 training/case/announcement/image_hero_summary。
`text_first` → timeline/deadline/submission/announcement。
