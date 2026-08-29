import type { QACheck, QAIssue, StyleProfile, CTA } from "../core/types.js";
import { validateCardJson } from "../renderer/card-validator.js";

/**
 * Brand QA (PRD §13.3) — style consistency & no style drift.
 */
export function runBrandQA(input: { style: StyleProfile; cardJson: any }): QACheck {
  const { style } = input;
  const issues: QAIssue[] = [];

  // Header template must be a known token consistent with the style.
  const validTemplates = new Set([
    "blue", "wathet", "turquoise", "green", "yellow", "orange",
    "red", "carmine", "violet", "purple", "indigo", "grey", "default",
  ]);
  if (!validTemplates.has(style.feishuHeaderTemplate)) {
    issues.push({
      code: "INVALID_HEADER_TEMPLATE",
      severity: "warning",
      message: `header template 非法：${style.feishuHeaderTemplate}`,
      stage: "brand_qa",
    });
  }

  // Style keywords must not contain forbidden aesthetics.
  const forbidden = ["cyberpunk", "neon", "gaming", "赛博", "霓虹", "电竞"];
  const kw = style.keywords.join(" ").toLowerCase();
  for (const f of forbidden) {
    if (kw.includes(f.toLowerCase())) {
      issues.push({ code: "STYLE_DRIFT", severity: "error", message: `风格漂移：出现禁用关键词 ${f}`, stage: "brand_qa" });
    }
  }

  return { name: "brand_qa", pass: !issues.some((i) => i.severity === "hard_fail"), issues };
}

/**
 * Feishu QA (PRD §13.4) — schema validity, CTA targets, secret safety.
 */
export function runFeishuQA(input: { cardJson: any; ctas: CTA[] }): QACheck {
  const { cardJson, ctas } = input;
  const issues: QAIssue[] = [];

  const validation = validateCardJson(cardJson);
  for (const err of validation.errors) {
    issues.push({ code: "CARD_SCHEMA_INVALID", severity: "hard_fail", message: err, stage: "feishu_qa" });
  }

  // CTA must have a real target (url or callback).
  for (const c of ctas) {
    if (c.type === "url" && !c.url) {
      issues.push({ code: "CTA_NO_TARGET", severity: "error", message: `按钮无跳转目标：${c.label}`, stage: "feishu_qa" });
    }
    if (c.type === "callback" && !c.callbackKey) {
      issues.push({ code: "CTA_NO_CALLBACK", severity: "error", message: `回调按钮缺少 key：${c.label}`, stage: "feishu_qa" });
    }
  }

  // Secret leakage guard: no secret-like strings in the serialized card.
  const serialized = JSON.stringify(cardJson);
  if (/app_secret|FEISHU_APP_SECRET|verification_token|encrypt_key|Bearer\s+[A-Za-z0-9._-]{10,}/i.test(serialized)) {
    issues.push({ code: "SECRET_LEAK", severity: "hard_fail", message: "卡片 JSON 中疑似包含密钥/Token", stage: "feishu_qa" });
  }

  return { name: "feishu_qa", pass: !issues.some((i) => i.severity === "hard_fail"), issues };
}
