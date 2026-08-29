import type { StyleProfile } from "../core/types.js";

/**
 * AI先锋大赛 default visual language (PRD §9.14, DESIGN §2, SKILL §25).
 * Premium AI × Feishu Native × iOS Editorial.
 */
export const DEFAULT_STYLE: StyleProfile = {
  slug: "ai-pioneer-default",
  brandIdentity: "AI先锋大赛 · 母设计语言",
  keywords: [
    "premium",
    "minimal",
    "low saturation",
    "soft gradient",
    "clear hierarchy",
    "generous spacing",
    "product-native",
    "editorial",
    "refined",
    "modern",
  ],
  visualDirection: "Premium AI × Feishu Native × iOS Editorial",
  emotionalTone: "克制、通透、高级、数字感",
  colors: {
    primaryBrand: "#2B6CF6",
    primaryText: "#1F2329",
    secondaryText: "#4E5969",
    mutedText: "#8A919F",
    surface: "#F7F9FC",
    elevatedSurface: "#FFFFFF",
    accent: "#00B0B9",
    success: "#2EA121",
    warning: "#D97A00",
    danger: "#D93026",
    divider: "#E5E6EB",
  },
  gradient: "linear 135deg #EEF3FF -> #F7FBFF (soft, low-saturation)",
  feishuHeaderTemplate: "blue",
  isBrandResolved: false,
  markdown: buildDefaultMarkdown(),
};

function buildDefaultMarkdown(): string {
  return `# Brand Identity
AI先锋大赛母设计语言：Premium AI × Feishu Native × iOS Editorial。

# Keywords
premium / minimal / low saturation / soft gradient / clear hierarchy / generous spacing / product-native / editorial / refined / modern

# Visual Direction
高级、克制、通透、精致、微渐变、大留白、清晰层级、数字感。默认浅色背景。

# Emotional Tone
克制、专业、可信、有推进感，不喧闹。

# Color System
- Primary Brand: #2B6CF6
- Primary Text: #1F2329
- Secondary Text: #4E5969
- Muted Text: #8A919F
- Surface: #F7F9FC
- Elevated Surface: #FFFFFF
- Accent: #00B0B9
- Success: #2EA121
- Warning: #D97A00
- Danger: #D93026
- Divider: #E5E6EB

大面积低饱和；高饱和只用于 CTA / 状态 / 关键时间；单卡主强调色不超过 2 种。

# Gradient
允许 蓝→青 / 蓝→紫 / 银灰→冷白 的极弱渐变。禁止五色彩虹、高饱和霓虹、渐变盖住正文。

# Typography
Display 26-32 / H1 20-24 / H2 16-18 / Body 14-16 / Caption 12-13。飞书组件受限时遵循相对层级。日期/数字可用更高 weight。

# Radius
Small 8 / Medium 12 / Large 16 / Hero 20。原生组件无法自定义时服从原生。

# Spacing
4 / 8 / 12 / 16 / 24 / 32。模块内紧、模块间松，第一视觉周围留白最多。

# Border
极细、低对比，仅用于分组。避免深色硬边框与表格感。

# Shadow
轻、扩散大、透明度低。仅用于 Hero / 重点模块。

# Icon
极简线性图标，服务信息，不堆砌。

# Emoji
每模块 0-1 个语义相关 Emoji 作为扫描锚点。禁止把 Emoji 文字化（📣 ≠ 【喇叭】）。

# Image
图片必须承担信息（概括 / 分组 / 结构 / 场景导航）。禁止无意义装饰。手机端缩放后仍可读。

# Illustration
抽象、低饱和、产品化插画；不做写实海报堆砌。

# Motion
slow gradient drift / subtle shimmer / breathing highlight / low particle。禁止持续闪烁、高速移动、大面积发光。

# Header
[Logo] AI先锋大赛  [日期/状态 Badge]；主副标题层级；微渐变背景；大留白；高对比文字。

# Button
Verb + Object。Primary ≤ 1，Secondary ≤ 4。禁止“点这里/更多/详情/链接”。

# Timeline
纵向优先：WHEN → WHAT；当前节点视觉权重最高。

# Badge
状态而非句子，≤ 4-6 字，不堆多个。

# Do
统一系列感 / 明确主次 / 抽象高级图形 / 轻交互与状态反馈 / 手机可快速扫读。

# Don't
普通通知海报 / 五彩 banner / 一次塞满 / 复杂动画 / 花哨图标与低质光效 / cyberpunk / 电竞 UI / 廉价科技蓝 / 大面积霓虹。
`;
}
