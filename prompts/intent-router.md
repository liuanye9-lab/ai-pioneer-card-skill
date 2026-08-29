# Intent Router Prompt

先判断卡片意图，再决定布局。禁止直接套模板。

## 输出
```json
{ "primary_intent": "", "primary_question": "", "primary_action": "", "recommended_layout": "", "confidence": 0.0 }
```

## 枚举
timeline / deadline / training / submission / case_showcase / announcement / registration / result / award / reminder / countdown / guide / custom

## 规则
- confidence < 0.65 → fallback 到 `announcement` + 保守布局。
- 不自行发明活动语义。
- 随后决定 Render Mode：text_first / image_assisted / image_led_navigation；再决定 Image Intent。

## 参考实现
`src/intent/card-intent-router.ts` · `render-mode-router.ts` · `image-intent-router.ts`
