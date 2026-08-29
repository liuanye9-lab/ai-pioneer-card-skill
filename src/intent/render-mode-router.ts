import type {
  CardIntentResult,
  ImageIntentResult,
  RenderModeResult,
  SourceOfTruth,
} from "../core/types.js";

/**
 * Render Mode Router (PRD v1.1 §J, SPEC §10, SKILL §10).
 *
 * Decides text_first / image_assisted / image_led_navigation. Depends on both
 * card intent and image intent so the three routers stay consistent.
 */

export function routeRenderMode(
  sot: SourceOfTruth,
  intent: CardIntentResult,
  imageIntent: ImageIntentResult,
): RenderModeResult {
  // image_led_navigation: image required + navigation-type roles.
  const navigationRoles = ["schedule_overview", "scene_navigation", "module_summary"];
  if (imageIntent.image_mode === "required" && navigationRoles.includes(imageIntent.image_role)) {
    return {
      render_mode: "image_led_navigation",
      cta_mode: "multi",
      image_required: true,
      reason:
        "图片承担课程/多入口概括，正文极少，按钮承担导航——采用 image_led_navigation。",
    };
  }

  // text_first: precise-fact intents or no image needed.
  if (
    imageIntent.image_mode === "not_needed" ||
    intent.primary_intent === "deadline" ||
    intent.primary_intent === "submission" ||
    intent.primary_intent === "reminder" ||
    intent.primary_intent === "countdown"
  ) {
    return {
      render_mode: "text_first",
      cta_mode: sot.actions.length > 1 ? "multi" : "single",
      image_required: false,
      reason: "以精确事实为核心，文字优先，图片最多作为轻量氛围。",
    };
  }

  // image_assisted: hero/case summary as support.
  if (imageIntent.image_mode === "recommended" || imageIntent.image_mode === "required") {
    return {
      render_mode: "image_assisted",
      cta_mode: sot.actions.length > 1 ? "multi" : "single",
      image_required: imageIntent.image_mode === "required",
      reason: "主视觉/案例摘要图作为辅助，正文承接核心事实。",
    };
  }

  return {
    render_mode: "text_first",
    cta_mode: "single",
    image_required: false,
    reason: "默认文字优先。",
  };
}
