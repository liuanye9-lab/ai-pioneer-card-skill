import type { QACheck, QAIssue, ImagePlan, CTA } from "../core/types.js";

/**
 * Image QA (PRD v1.1 §G.1, SPEC §21) + Navigation QA (§G.2).
 */
export function runImageQA(input: { imagePlan?: ImagePlan; ctas: CTA[]; cardText: string }): QACheck {
  const { imagePlan, ctas, cardText } = input;
  const issues: QAIssue[] = [];

  if (!imagePlan) {
    return { name: "image_qa", pass: true, issues };
  }

  // Image must carry information (have a role + modules or a hero concept).
  if (imagePlan.modules.length === 0 && imagePlan.role !== "hero_summary") {
    issues.push({
      code: "IMAGE_NO_INFO",
      severity: "warning",
      message: "信息型图片缺少模块，可能只是装饰",
      stage: "image_qa",
    });
  }

  // Mobile readable (hard gate under mobile-first).
  if (imagePlan.mobile_readable_without_zoom === false) {
    issues.push({
      code: "IMAGE_NOT_MOBILE_READABLE",
      severity: "hard_fail",
      message: "图片核心文字在手机端需放大才能读；应拆图/减模块/转原生文字",
      stage: "image_qa",
    });
  }

  // Critical facts must be repeated in native card text.
  for (const fact of imagePlan.critical_facts_repeated_in_card) {
    const core = fact.replace(/截止$/, "");
    if (!cardText.includes(core)) {
      issues.push({
        code: "CRITICAL_FACT_ONLY_IN_IMAGE",
        severity: "hard_fail",
        message: `关键事实疑似只在图片中，未在原生文字承接：${fact}`,
        stage: "image_qa",
      });
    }
  }

  // Image module ↔ CTA mapping for navigation.
  if (imagePlan.role === "schedule_overview" || imagePlan.role === "scene_navigation") {
    const mappedCtas = ctas.filter((c) => c.mapsToImageModule);
    if (imagePlan.modules.length > 0 && mappedCtas.length === 0) {
      issues.push({
        code: "NO_IMAGE_CTA_MAPPING",
        severity: "error",
        message: "信息图包含模块，但没有与之对应的按钮（看图不知道点哪里）",
        stage: "image_qa",
      });
    }
  }

  return { name: "image_qa", pass: !issues.some((i) => i.severity === "hard_fail"), issues };
}

export function runNavigationQA(input: { ctas: CTA[] }): QACheck {
  const { ctas } = input;
  const issues: QAIssue[] = [];

  const primary = ctas.filter((c) => c.priority === "primary");
  const secondary = ctas.filter((c) => c.priority === "secondary");

  if (primary.length > 1) {
    issues.push({ code: "MULTIPLE_PRIMARY", severity: "error", message: `Primary CTA 超过 1 个（${primary.length}）`, stage: "navigation_qa" });
  }
  if (secondary.length > 4) {
    issues.push({ code: "TOO_MANY_SECONDARY", severity: "error", message: `Secondary CTA 超过 4 个（${secondary.length}）`, stage: "navigation_qa" });
  }

  // Banned vague labels.
  const banned = ["更多", "详情", "点这里", "链接", "点击查看"];
  for (const c of ctas) {
    if (banned.includes(c.label)) {
      issues.push({ code: "VAGUE_CTA", severity: "error", message: `按钮文案不是动作导向：${c.label}`, stage: "navigation_qa" });
    }
  }

  // Duplicate labels.
  const labels = ctas.map((c) => c.label);
  if (new Set(labels).size !== labels.length) {
    issues.push({ code: "DUPLICATE_CTA", severity: "warning", message: "存在语义重复的按钮", stage: "navigation_qa" });
  }

  return { name: "navigation_qa", pass: !issues.some((i) => i.severity === "hard_fail"), issues };
}
