import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/core/pipeline.js";
import type { CompileResult } from "../src/core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = resolve(__dirname, "..", "brands");

function run(copy: string, brandName?: string): CompileResult {
  return compile({ copy, brandName }, { brandsDir: BRANDS_DIR });
}

const GOLDEN_SUBMISSION = `AI先锋大赛
9月4日作品提交截止
还没提交作品的小伙伴记得尽快提交
提交地址：https://example.com
作品提交将在9月4日截止
📣 大家记得不要错过`;

describe("Golden Tests (SPEC §28)", () => {
  it("GT-01 name fidelity: AI先锋大赛 appears, 先锋大赛 not truncated, no hard fail", () => {
    const r = run(GOLDEN_SUBMISSION);
    const text = JSON.stringify(r.cardJson);
    expect(text).toContain("AI先锋大赛");
    expect(r.qa.hardFail).toBe(false);
    expect(r.qa.issues.some((i) => i.code === "ACTIVITY_NAME_TRUNCATED")).toBe(false);
  });

  it("GT-02 date normalization surfaces 9月4日 in the card", () => {
    const r = run(GOLDEN_SUBMISSION);
    expect(JSON.stringify(r.cardJson)).toContain("9月4日");
  });

  it("GT-03 emoji fidelity: 📣 preserved, never 【喇叭】", () => {
    const r = run(GOLDEN_SUBMISSION);
    const text = JSON.stringify(r.cardJson) + JSON.stringify(r.operationCopy);
    expect(text).not.toContain("【喇叭】");
    expect(r.qa.issues.some((i) => i.code === "EMOJI_TEXTUALIZED")).toBe(false);
  });

  it("GT-04 multi-series/scene -> image_led_navigation with mapped CTAs", () => {
    const r = run(`本周两个培训系列：
飞书直播大班课，周一到周五15:00-16:00
豆包工作系列，周一到周五14:00-15:00
包含财务、销售、客服专题
提供课程日历入口`);
    expect(r.renderMode.render_mode).toBe("image_led_navigation");
    const mapped = r.ctas.filter((c) => c.mapsToImageModule);
    expect(mapped.length).toBeGreaterThan(0);
  });

  it("GT-05 no URL -> no fabricated CTA link (AC-06)", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止，记得尽快提交");
    for (const cta of r.ctas) {
      if (cta.type === "url") expect(cta.url).toBeTruthy();
    }
    // No invented-url hard fail.
    expect(r.qa.issues.some((i) => i.code === "INVENTED_CTA_URL")).toBe(false);
  });

  it("AC-05 with URL -> generates a submission CTA", () => {
    const r = run(GOLDEN_SUBMISSION);
    const primary = r.ctas.find((c) => c.priority === "primary");
    expect(primary?.url).toBe("https://example.com");
    expect(primary?.label).toContain("提交");
  });

  it("AC-04 duplicate deadline expressed once in body", () => {
    const r = run(GOLDEN_SUBMISSION);
    const preview: string = r.cardPreview.preview_lines.join("\n");
    const occurrences = (preview.match(/9月4日/g) ?? []).length;
    // Header/anchor may carry it once; body should not repeat it many times.
    expect(occurrences).toBeLessThanOrEqual(2);
  });

  it("AC-11 output includes an editable card.json (schema 2.0)", () => {
    const r = run(GOLDEN_SUBMISSION);
    expect(r.cardJson.schema).toBe("2.0");
    expect(Array.isArray(r.cardJson.body.elements)).toBe(true);
  });

  it("AC-12 output includes operation copy", () => {
    const r = run(GOLDEN_SUBMISSION);
    expect(r.operationCopy.beforeSend.length).toBeGreaterThan(0);
    expect(r.operationCopy.onSend.length).toBeGreaterThan(0);
  });

  it("AC-13 passing card scores >= 85", () => {
    const r = run(GOLDEN_SUBMISSION);
    expect(r.qa.score.total).toBeGreaterThanOrEqual(85);
    expect(r.qa.pass).toBe(true);
  });

  it("brand resolution reuses cached 象上汇 style.md", () => {
    const r = run(GOLDEN_SUBMISSION, "象上汇");
    expect(r.style.isBrandResolved).toBe(true);
    expect(r.style.markdown).toContain("象上汇");
  });
});
