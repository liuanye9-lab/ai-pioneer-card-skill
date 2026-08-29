import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CompileResult } from "../core/types.js";

/**
 * Bundle Writer (PRD §9.19, SPEC §22 & §45). Writes every required artifact to
 * outputs/{slug}/ so the result is fully editable and inspectable.
 */
export function writeBundle(outputsDir: string, result: CompileResult): string {
  const dir = join(outputsDir, result.slug);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "assets", "mobile"), { recursive: true });
  mkdirSync(join(dir, "assets", "desktop"), { recursive: true });

  const writeJson = (name: string, data: unknown) =>
    writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + "\n", "utf8");
  const writeText = (name: string, text: string) => writeFileSync(join(dir, name), text, "utf8");

  writeJson("source_of_truth.json", result.sourceOfTruth);
  writeJson("intent.json", {
    intent: result.intent,
    render_mode: result.renderMode,
    image_intent: result.imageIntent,
    attention: result.attention,
  });
  writeJson("render_plan.json", result.renderPlan);
  writeJson("mobile_layout.json", result.mobileLayout);
  writeText("style.md", result.style.markdown);
  writeText("card_content.md", result.cardContentMarkdown);
  writeJson("card.json", result.cardJson);
  writeJson("card.preview.json", result.cardPreview);
  writeText("operation_copy.md", renderOperationCopyMd(result));
  writeJson("qa_report.json", result.qa);
  writeJson("cross_device_qa.json", result.crossDeviceQA);
  writeJson("preflight.json", result.preflight);
  writeJson("publish_status.json", {
    status: result.publishStatus,
    scope_checklist: result.scopeChecklist,
  });

  // Image prompt (if any).
  if (result.imagePlan) {
    writeText(join("assets", "image_prompt.md"), renderImagePromptMd(result));
  }

  return dir;
}

function renderOperationCopyMd(result: CompileResult): string {
  const c = result.operationCopy;
  const lines = [
    `# 运营话术 — ${result.sourceOfTruth.activity_name ?? "活动"}`,
    "",
    "## 发卡前",
    c.beforeSend,
    "",
    "## 发卡时",
    c.onSend,
    "",
    "## 发卡后",
    c.afterSend,
    "",
    "## Deadline Reminder",
    c.deadlineReminder || "（本卡无需截止提醒）",
    "",
  ];
  return lines.join("\n");
}

function renderImagePromptMd(result: CompileResult): string {
  const p = result.imagePlan!;
  return [
    `# 图片规划 — ${p.role}`,
    "",
    `- 比例：${p.aspect_ratio}`,
    `- 主标题：${p.hero_title}`,
    p.hero_subtitle ? `- 副标题：${p.hero_subtitle}` : "",
    `- 移动端可读（无需放大）：${p.mobile_readable_without_zoom}`,
    `- 中文原生文字降级：${p.native_text_fallback}`,
    "",
    "## 模块",
    ...p.modules.map((m) => `- ${m.title}${m.key_points.length ? `：${m.key_points.join(" / ")}` : ""}`),
    "",
    "## 必须在原生文字/CTA 承接的关键事实",
    ...p.critical_facts_repeated_in_card.map((f) => `- ${f}`),
    "",
    "## Prompt",
    "```",
    p.prompt.replace(/\\n/g, "\n"),
    "```",
    "",
    "## Negative Prompt",
    "```",
    p.negative_prompt ?? "",
    "```",
    "",
    "## Variants",
    ...p.variants.map((v) => `- ${v.usage}: ${v.aspectRatio}${v.minReadableTextSizePx ? ` (min text ${v.minReadableTextSizePx}px)` : ""}`),
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
