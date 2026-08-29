import type { RenderMode } from "../core/types.js";

/**
 * Template Registry (SPEC §24). Templates describe LAYOUT STRATEGY only — no
 * literal copy. The renderer consults these to know required blocks and CTA
 * caps for a given intent/render-mode combination.
 */

export interface TemplateDef {
  name: string;
  requiredBlocks: string[];
  maxSecondaryCTA: number;
  renderMode: RenderMode;
  description: string;
}

const registry = new Map<string, TemplateDef>();

export function registerTemplate(name: string, def: Omit<TemplateDef, "name">): void {
  registry.set(name, { name, ...def });
}

export function getTemplate(name: string): TemplateDef | undefined {
  return registry.get(name);
}

export function listTemplates(): TemplateDef[] {
  return [...registry.values()];
}

// ---- Core P0 templates (PRD §15) ----
registerTemplate("timeline", {
  requiredBlocks: ["header", "primaryAnchor", "timeline"],
  maxSecondaryCTA: 2,
  renderMode: "text_first",
  description: "纵向时间线：日期→任务→状态。",
});
registerTemplate("deadline", {
  requiredBlocks: ["header", "primaryAnchor", "primaryCTA"],
  maxSecondaryCTA: 2,
  renderMode: "text_first",
  description: "截止聚焦：截止时间为第一视觉。",
});
registerTemplate("training", {
  requiredBlocks: ["header", "image", "primaryAnchor", "primaryCTA"],
  maxSecondaryCTA: 3,
  renderMode: "image_assisted",
  description: "培训：主题→时间→收获→入口。",
});
registerTemplate("submission", {
  requiredBlocks: ["header", "primaryAnchor", "primaryCTA"],
  maxSecondaryCTA: 2,
  renderMode: "text_first",
  description: "提交：提交内容→截止→要求→提交按钮。",
});
registerTemplate("case", {
  requiredBlocks: ["header", "image", "primaryAnchor", "primaryCTA"],
  maxSecondaryCTA: 3,
  renderMode: "image_assisted",
  description: "案例：场景→亮点→查看案例。",
});
registerTemplate("announcement", {
  requiredBlocks: ["header", "primaryAnchor"],
  maxSecondaryCTA: 2,
  renderMode: "image_assisted",
  description: "通知：通知主题为核心。",
});

// ---- Image navigation templates (PRD v1.1 §E) ----
registerTemplate("image_hero_summary", {
  requiredBlocks: ["header", "image", "primaryCTA"],
  maxSecondaryCTA: 3,
  renderMode: "image_assisted",
  description: "主视觉摘要图 + 主 CTA。",
});
registerTemplate("image_schedule_overview", {
  requiredBlocks: ["header", "image", "primaryCTA", "secondaryCTAGrid"],
  maxSecondaryCTA: 4,
  renderMode: "image_led_navigation",
  description: "课程排期概览图 + 查看课程日历 + 分专题按钮。",
});
registerTemplate("image_multi_entry", {
  requiredBlocks: ["header", "image", "primaryCTA", "secondaryCTAGrid"],
  maxSecondaryCTA: 4,
  renderMode: "image_led_navigation",
  description: "多入口导航：主视觉图 + 主入口 + 分模块按钮。",
});
registerTemplate("image_case_navigation", {
  requiredBlocks: ["header", "image", "secondaryCTAGrid"],
  maxSecondaryCTA: 4,
  renderMode: "image_led_navigation",
  description: "多案例导航。",
});
registerTemplate("image_training_digest", {
  requiredBlocks: ["header", "image", "primaryCTA"],
  maxSecondaryCTA: 4,
  renderMode: "image_led_navigation",
  description: "培训摘要 + 课程日历入口。",
});

/** Choose a template name from intent + render mode. */
export function chooseTemplate(intent: string, renderMode: RenderMode): string {
  if (renderMode === "image_led_navigation") {
    if (intent === "training") return "image_schedule_overview";
    if (intent === "case_showcase") return "image_case_navigation";
    return "image_multi_entry";
  }
  if (renderMode === "image_assisted") {
    if (intent === "training") return "training";
    if (intent === "case_showcase") return "case";
    if (intent === "announcement" || intent === "result" || intent === "award")
      return "announcement";
    return "image_hero_summary";
  }
  // text_first
  switch (intent) {
    case "timeline":
      return "timeline";
    case "deadline":
      return "deadline";
    case "submission":
      return "submission";
    default:
      return "announcement";
  }
}
