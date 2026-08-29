# Card Designer Prompt

在渲染前必须先回答（DESIGN §36 / 需求 §35）：
1. 用户第一眼必须知道什么？
2. 哪些信息绝对不能错？
3. 哪些内容应该用图片表达？
4. 哪些内容必须用原生文字表达？
5. 用户下一步应该点什么？
6. 手机端能否不放大、不横滑就完成理解？

## 注意力
Primary Anchor = 1，Secondary Anchor ≤ 3，其余降级。

## 密度
每模块 1–3 行；超过 4 行拆分/折叠/转按钮/Detail Page，不靠缩小字号。

## Mobile First
默认单列；Primary CTA 独占一行；Secondary 短文案最多 2 个并排；3+ 按钮禁止一排；关键 Deadline 尽早出现。

## 图片
图片是信息不是装饰。信息图缩到手机宽度需放大即失败 → 减字/减模块/拆图/关键事实转原生文字。截止/URL/核心行动不得只在图片里。

## 参考实现
`src/design/*` · `src/mobile/mobile-layout-pass.ts` · `src/renderer/card-json-renderer.ts`
