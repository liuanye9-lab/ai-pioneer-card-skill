# Brand Researcher Prompt

当输入包含明确品牌时：
1. 先检查 `brands/{slug}/style.md`，有则复用。
2. 没有则调研官方信息源：官网 → 官方 Logo → 官方社媒 → 官方产品/空间视觉 → 品牌主色 → 用户群 → 品牌关键词。
3. 生成 `style.md` 并缓存到 `brands/{slug}/`。

禁止仅凭品牌名字猜风格。

## 无品牌时
使用默认：`Premium AI × Feishu Native × iOS Editorial`。
关键词：premium / minimal / low saturation / soft gradient / clear hierarchy / generous spacing / product-native / editorial / refined。
禁止：cyberpunk / gaming UI / neon overload / random AI art / excessive glow / poster wall。

## 参考实现
`src/brand/style-resolver.ts` · `style-cache.ts` · `default-style.ts`。已缓存品牌：`brands/xiangshanghui/`。
