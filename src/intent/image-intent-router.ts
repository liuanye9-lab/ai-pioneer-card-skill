import type { SourceOfTruth, CardIntentResult, ImageIntentResult } from "../core/types.js";

/**
 * Image Intent Router (PRD v1.1 §C, SPEC §11, SKILL §11-12).
 *
 * Answers: should this content become an information-bearing image, or stay
 * as text? We never add imagery just for "premium feel"; the image must earn
 * its place by summarizing structure that text lists poorly.
 */

interface ImageSignals {
  parallelModules: number;
  hasSchedule: boolean;
  multiEntry: boolean;
  multiScene: boolean;
  infoBlockCount: number;
  strongHeroNeed: boolean;
}

function gatherSignals(sot: SourceOfTruth, intent: CardIntentResult, rawCopy: string): ImageSignals {
  const copy = rawCopy;
  const seriesMatches = copy.match(/系列|专场|专题|大班课|工作系列/g) ?? [];
  const parallelModules =
    new Set(seriesMatches).size + (sot.times.length >= 2 ? 1 : 0);

  const hasSchedule =
    /周[一二三四五六日]/.test(copy) ||
    sot.times.length >= 2 ||
    /课程表|排期|日历|每天|每周/.test(copy);

  const multiEntry =
    (copy.match(/入口|专场|专题|页面/g) ?? []).length >= 2 || sot.links.length >= 2;

  const multiScene = (copy.match(/财务|销售|客服|人力|市场|运营/g) ?? []).length >= 2;

  // Approximate "information blocks" = sentences carrying a fact.
  const infoBlockCount =
    sot.dates.length + sot.times.length + sot.actions.length + sot.rules.length +
    sot.submission_requirements.length + sot.rewards.length;

  const strongHeroNeed =
    intent.primary_intent === "announcement" ||
    intent.primary_intent === "result" ||
    intent.primary_intent === "award" ||
    /启动|开启|就位|上线|新阶段/.test(copy);

  return { parallelModules, hasSchedule, multiEntry, multiScene, infoBlockCount, strongHeroNeed };
}

export function routeImageIntent(
  sot: SourceOfTruth,
  intent: CardIntentResult,
  rawCopy: string,
): ImageIntentResult {
  const s = gatherSignals(sot, intent, rawCopy);

  // Strong navigation/schedule signals => image is required.
  const navigationScore =
    (s.parallelModules >= 2 ? 2 : 0) +
    (s.hasSchedule ? 2 : 0) +
    (s.multiEntry ? 1 : 0) +
    (s.multiScene ? 2 : 0) +
    (s.infoBlockCount > 6 ? 1 : 0);

  if (navigationScore >= 4) {
    return {
      image_mode: "required",
      image_role: s.hasSchedule ? "schedule_overview" : "scene_navigation",
      reason:
        "存在多个并列模块 / 排期 / 多入口，图片比纯文字更利于扫读与分组，触发信息型图片。",
      text_to_image_ratio: "30_70",
    };
  }

  // Deadline / submission / short reminder: precise facts, text wins.
  if (
    intent.primary_intent === "deadline" ||
    intent.primary_intent === "submission" ||
    intent.primary_intent === "reminder" ||
    intent.primary_intent === "countdown"
  ) {
    return {
      image_mode: "not_needed",
      image_role: "none",
      reason: "以精确事实（截止/提交/提醒）为核心，纯文字表达更快更准，无需图片。",
      text_to_image_ratio: "70_30",
    };
  }

  // Training / case / announcement with a hero need: assisted image.
  if (
    intent.primary_intent === "training" ||
    intent.primary_intent === "case_showcase" ||
    intent.primary_intent === "announcement" ||
    intent.primary_intent === "result" ||
    intent.primary_intent === "award" ||
    s.strongHeroNeed
  ) {
    return {
      image_mode: "recommended",
      image_role: intent.primary_intent === "case_showcase" ? "case_summary" : "hero_summary",
      reason: "主题型通知/培训/案例，主视觉能建立第一眼吸引与主题记忆，图片作为辅助。",
      text_to_image_ratio: "50_50",
    };
  }

  return {
    image_mode: "optional",
    image_role: "none",
    reason: "信息以文字即可清晰表达，图片非必需。",
    text_to_image_ratio: "70_30",
  };
}
