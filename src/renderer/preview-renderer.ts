import type { CardStructure, CTA, MobileLayoutPlan, ImagePlan } from "../core/types.js";

/**
 * Preview Renderer. Produces card.preview.json — a flattened, human-readable
 * view of the mobile reading order that reviewers can scan without a Feishu
 * client. It is intentionally lossy (no raw component JSON).
 */
export function renderPreview(input: {
  structure: CardStructure;
  ctas: CTA[];
  mobileLayout: MobileLayoutPlan;
  imagePlan?: ImagePlan;
}): any {
  const { structure, ctas, mobileLayout, imagePlan } = input;

  const lines: string[] = [];
  const anchor = structure.primaryAnchor.content;
  lines.push(`[HEADER] ${structure.header.activityName}${structure.header.badge ? `  ⟨${structure.header.badge}⟩` : ""}`);
  lines.push(`[PRIMARY] ${anchor?.emoji ?? ""} ${anchor?.title ?? ""}${anchor?.subtitle ? ` / ${anchor.subtitle}` : ""}`);

  if (imagePlan) {
    lines.push(`[IMAGE:${imagePlan.role}] ${imagePlan.hero_title}${imagePlan.native_text_fallback ? " (native-text overlay)" : ""}`);
    for (const m of imagePlan.modules) lines.push(`   • ${m.title}${m.key_points.length ? ` — ${m.key_points.join(" / ")}` : ""}`);
  }

  for (const b of [...structure.body].sort((a, z) => a.priority - z.priority)) {
    const c = b.content ?? {};
    if (b.type === "timeline") {
      for (const n of c.nodes ?? []) lines.push(`   ${n.status === "current" ? "●" : "○"} ${n.date} · ${n.task}`);
    } else {
      lines.push(`   ${c.emoji ?? ""} ${c.text ?? c.title ?? ""}`.trim());
    }
  }

  const primary = ctas.find((c) => c.priority === "primary");
  if (primary) lines.push(`[PRIMARY CTA] [ ${primary.label} ] -> ${primary.url ?? `callback:${primary.callbackKey}`}`);
  const secondary = ctas.filter((c) => c.priority === "secondary");
  if (secondary.length) {
    lines.push(`[SECONDARY CTA · ${mobileLayout.secondaryCTAStyle}]`);
    for (const s of secondary) lines.push(`   [ ${s.label} ] -> ${s.url ?? `callback:${s.callbackKey}`}`);
  }

  return {
    mobile_reading_order: mobileLayout.readingOrder,
    column_strategy: mobileLayout.columnStrategy,
    secondary_cta_style: mobileLayout.secondaryCTAStyle,
    above_the_fold: mobileLayout.criticalFactsAboveFold,
    preview_lines: lines,
  };
}
