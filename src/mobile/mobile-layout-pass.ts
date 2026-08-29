import type {
  CardStructure,
  CTA,
  ImagePlan,
  MobileLayoutPlan,
  RenderModeResult,
  SourceOfTruth,
} from "../core/types.js";
import { SHORT_LABEL_MAX_CHARS } from "../core/constants.js";

/**
 * Mobile Layout Pass (PRD §26/FR-31, SPEC §33-36, SKILL §40-43).
 *
 * This is NOT "shrink desktop". It re-derives the mobile information structure:
 * single-column reading order, above-the-fold critical facts, and a CTA
 * strategy that never crowds a button row.
 */

export function runMobileLayoutPass(input: {
  structure: CardStructure;
  renderMode: RenderModeResult;
  imagePlan?: ImagePlan;
  sot: SourceOfTruth;
  ctas: CTA[];
}): MobileLayoutPlan {
  const { structure, renderMode, imagePlan, sot, ctas } = input;
  const warnings: string[] = [];

  // ---- Reading order (top -> bottom, mobile semantic order) ----
  const readingOrder: string[] = ["header", "primary_anchor"];

  // Critical time/status right after the anchor.
  const criticalFacts: string[] = [];
  if (sot.deadlines[0]) criticalFacts.push(`${sot.deadlines[0].date}截止`);
  else if (sot.dates[0]) criticalFacts.push(sot.dates[0].value);
  if (sot.actions[0]) criticalFacts.push(sot.actions[0].action);

  if (criticalFacts.length) readingOrder.push("critical_time");

  // Image placement depends on render mode.
  const imageMode: MobileLayoutPlan["imageMode"] = imagePlan
    ? imagePlan.role === "hero_summary"
      ? "hero"
      : "information"
    : "none";

  if (renderMode.render_mode === "image_led_navigation" && imagePlan) {
    readingOrder.push("information_image", "primary_cta", "secondary_cta_grid", "supporting_note");
  } else if (renderMode.render_mode === "image_assisted" && imagePlan) {
    readingOrder.push("hero_image", "primary_content", "primary_cta", "secondary_info");
  } else {
    readingOrder.push("primary_content", "primary_cta", "secondary_info");
  }

  // ---- Column strategy ----
  // Default single column. Limited two-column only for two short symmetric CTAs.
  const secondaryCtas = ctas.filter((c) => c.priority === "secondary");
  const allSecondaryShort = secondaryCtas.every((c) => c.label.length <= SHORT_LABEL_MAX_CHARS);

  let columnStrategy: MobileLayoutPlan["columnStrategy"] = "single";
  let secondaryCTAStyle: MobileLayoutPlan["secondaryCTAStyle"] = "stacked";
  let maxSecondaryCTAPerRow: 1 | 2 = 1;

  if (secondaryCtas.length === 2 && allSecondaryShort) {
    columnStrategy = "limited_two_column";
    secondaryCTAStyle = "two_column";
    maxSecondaryCTAPerRow = 2;
  } else if (secondaryCtas.length >= 3) {
    // 3-4 secondary: stacked or 2+? Keep 2-per-row ONLY if all short, else stacked.
    if (allSecondaryShort) {
      secondaryCTAStyle = "two_column";
      maxSecondaryCTAPerRow = 2;
    } else {
      secondaryCTAStyle = "stacked";
      maxSecondaryCTAPerRow = 1;
      warnings.push("次级按钮文案较长，已强制纵向堆叠，避免手机端一行挤压。");
    }
  }

  // Hard guard: never allow 3+ per row (FR-33 / AC-19).
  if (maxSecondaryCTAPerRow > 2) maxSecondaryCTAPerRow = 2;

  // ---- Above-the-fold ----
  const criticalFactsAboveFold = criticalFacts.slice(0, 3);

  // ---- Image readability verdict ----
  const imageReadableWithoutZoom = imagePlan ? imagePlan.mobile_readable_without_zoom ?? true : true;
  if (imagePlan && imageReadableWithoutZoom === false) {
    warnings.push("信息图模块/文字过密，手机端可能需要放大：已建议拆图/减模块/关键事实转原生文字。");
  }

  // ---- Structure sanity: no 3+ column body ----
  const hasWideColumns = structure.body.some(
    (b) => b.type === "columns" && Array.isArray(b.content?.columns) && b.content.columns.length >= 3,
  );
  if (hasWideColumns) {
    warnings.push("检测到 3 列以上正文，手机端不允许，已标记需重排为单列。");
  }

  // Primary CTA placement: early for deadline/submission.
  const primaryCTAPlacement: MobileLayoutPlan["primaryCTAPlacement"] =
    renderMode.render_mode === "text_first" ? "after_primary_content" : "after_primary_content";

  return {
    mobile_first: true,
    readingOrder,
    columnStrategy,
    primaryAnchorPosition: "top",
    primaryCTAPlacement,
    secondaryCTAStyle,
    maxSecondaryCTAPerRow,
    imageMode,
    imageReadableWithoutZoom,
    criticalFactsAboveFold,
    warnings,
  };
}
