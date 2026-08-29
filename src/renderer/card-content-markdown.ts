import type { CardStructure, CTA, ImagePlan } from "../core/types.js";

/**
 * card_content.md generator (PRD §9.19). A fully editable, human-first view of
 * the card content so operators can tweak copy without touching JSON.
 */
export function renderCardContentMarkdown(input: {
  structure: CardStructure;
  ctas: CTA[];
  imagePlan?: ImagePlan;
}): string {
  const { structure, ctas, imagePlan } = input;
  const out: string[] = [];

  out.push(`# ${structure.header.activityName}`);
  if (structure.header.badge) out.push(`> Badge: ${structure.header.badge}`);
  out.push("");

  const anchor = structure.primaryAnchor.content;
  out.push(`## 第一视觉重点`);
  out.push(`${anchor?.emoji ?? ""} **${anchor?.title ?? ""}**`.trim());
  if (anchor?.subtitle) out.push(anchor.subtitle);
  out.push("");

  if (imagePlan) {
    out.push(`## 信息图（${imagePlan.role}）`);
    out.push(`- 主标题：${imagePlan.hero_title}`);
    if (imagePlan.hero_subtitle) out.push(`- 副标题：${imagePlan.hero_subtitle}`);
    if (imagePlan.modules.length) {
      out.push(`- 模块：`);
      for (const m of imagePlan.modules)
        out.push(`  - ${m.title}${m.key_points.length ? `：${m.key_points.join(" / ")}` : ""}`);
    }
    if (imagePlan.critical_facts_repeated_in_card.length) {
      out.push(`- ⚠️ 以下关键事实必须同时在原生文字/CTA 中保留：${imagePlan.critical_facts_repeated_in_card.join("、")}`);
    }
    out.push("");
  }

  const bodyBlocks = [...structure.body].sort((a, b) => a.priority - b.priority);
  if (bodyBlocks.length) {
    out.push(`## 正文`);
    for (const b of bodyBlocks) {
      const c = b.content ?? {};
      if (b.type === "timeline") {
        for (const n of c.nodes ?? []) out.push(`- ${n.date} · ${n.task}（${n.status}）`);
      } else {
        out.push(`- ${c.emoji ?? ""} ${c.text ?? c.title ?? ""}`.trim());
      }
    }
    out.push("");
  }

  const primary = ctas.find((c) => c.priority === "primary");
  const secondary = ctas.filter((c) => c.priority === "secondary");
  if (primary || secondary.length) {
    out.push(`## 按钮`);
    if (primary) out.push(`- [主] ${primary.label} → ${primary.url ?? `callback:${primary.callbackKey}`}`);
    for (const s of secondary) out.push(`- [次] ${s.label} → ${s.url ?? `callback:${s.callbackKey}`}`);
    out.push("");
  }

  return out.join("\n");
}
