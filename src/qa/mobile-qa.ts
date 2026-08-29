import type {
  QACheck,
  QAIssue,
  MobileLayoutPlan,
  CTA,
  CrossDeviceQAResult,
  ImagePlan,
} from "../core/types.js";

/**
 * Mobile QA (PRD §34, SKILL §48) — the mobile-first hard gates.
 */
export function runMobileQA(input: {
  mobileLayout: MobileLayoutPlan;
  ctas: CTA[];
  imagePlan?: ImagePlan;
  primaryCtaMobileUsable: boolean;
}): QACheck {
  const { mobileLayout, ctas, imagePlan, primaryCtaMobileUsable } = input;
  const issues: QAIssue[] = [];

  // Horizontal scroll / 3+ columns.
  if (mobileLayout.columnStrategy !== "single" && mobileLayout.columnStrategy !== "limited_two_column") {
    issues.push({ code: "MOBILE_MULTI_COLUMN", severity: "hard_fail", message: "手机端出现 3 列以上/非法列策略", stage: "mobile_qa" });
  }

  // 3+ CTAs per row.
  if (mobileLayout.maxSecondaryCTAPerRow > 2) {
    issues.push({ code: "CROWDED_BUTTON_ROW", severity: "hard_fail", message: "一行按钮超过 2 个", stage: "mobile_qa" });
  }
  const secondary = ctas.filter((c) => c.priority === "secondary");
  if (secondary.length >= 3 && mobileLayout.maxSecondaryCTAPerRow === 2) {
    // 3 short buttons in 2-per-row => 2+1, acceptable. 4 => 2+2 acceptable. Only fail if declared >2.
  }

  // Image readability.
  if (imagePlan && mobileLayout.imageReadableWithoutZoom === false) {
    issues.push({ code: "IMAGE_ZOOM_REQUIRED", severity: "hard_fail", message: "图片核心文字需放大才能读", stage: "mobile_qa" });
  }

  // Primary CTA must be mobile-usable.
  const primary = ctas.find((c) => c.priority === "primary");
  if (primary && primary.type === "url" && !primaryCtaMobileUsable) {
    issues.push({ code: "PRIMARY_CTA_DESKTOP_ONLY", severity: "hard_fail", message: "Primary CTA 跳转疑似仅桌面端可用", stage: "mobile_qa" });
  }

  // Critical facts above the fold.
  if (mobileLayout.criticalFactsAboveFold.length === 0) {
    issues.push({ code: "NO_ABOVE_FOLD_FACT", severity: "warning", message: "首屏未明确关键事实", stage: "mobile_qa" });
  }

  // Carry through any warnings from the layout pass.
  for (const w of mobileLayout.warnings) {
    issues.push({ code: "MOBILE_LAYOUT_WARNING", severity: "warning", message: w, stage: "mobile_qa" });
  }

  return { name: "mobile_qa", pass: !issues.some((i) => i.severity === "hard_fail"), issues };
}

/**
 * Cross-device QA Runner (SPEC §42, SKILL §49). Mobile fail => overall fail.
 */
export function runCrossDeviceQA(input: {
  mobileCheck: QACheck;
  primaryCtaMobileUsable: boolean;
  hasImage: boolean;
}): CrossDeviceQAResult {
  const { mobileCheck, primaryCtaMobileUsable } = input;

  const mobileIssues = mobileCheck.issues.filter((i) => i.severity !== "warning").map((i) => i.message);
  const mobilePass = mobileCheck.pass;

  // iOS / Android mirror mobile with client-usability checks.
  const iosIssues: string[] = [];
  const androidIssues: string[] = [];
  if (!primaryCtaMobileUsable) {
    iosIssues.push("Primary CTA 需验证 iOS 可打开");
    androidIssues.push("Primary CTA 需验证 Android 可打开");
  }

  const desktopIssues: string[] = []; // desktop enhancement never breaks mobile order

  const overallPass = mobilePass; // Mobile Fail = Final Fail

  return {
    mobile: { pass: mobilePass, issues: mobileIssues },
    ios: { pass: mobilePass && iosIssues.length === 0, issues: iosIssues },
    android: { pass: mobilePass && androidIssues.length === 0, issues: androidIssues },
    desktop: { pass: true, issues: desktopIssues },
    overallPass,
  };
}

// Re-export QAIssue for callers that build ad-hoc issues.
export type { QAIssue };
