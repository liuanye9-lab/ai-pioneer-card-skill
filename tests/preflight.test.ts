import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/core/pipeline.js";
import type { CompileResult } from "../src/core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = resolve(__dirname, "..", "brands");

function run(copy: string, extra: Partial<Parameters<typeof compile>[0]> = {}): CompileResult {
  return compile({ copy, ...extra }, { brandsDir: BRANDS_DIR });
}

describe("Fallback layer / preflight (兜底层)", () => {
  it("越界拒绝: pure long-form writing routes to the doc-writing Skill", () => {
    const r = run("帮我写一篇关于团队协作的公众号文章");
    expect(r.preflight.status).toBe("out_of_scope");
    expect(r.preflight.proceed).toBe(false);
    expect(r.preflight.boundary.suggestedSkill).toContain("文档");
    expect(r.cardJson).toBeNull();
  });

  it("explicit '卡片' keeps an otherwise-ambiguous request in scope", () => {
    const r = run("帮我做一张活动方案卡片，AI先锋大赛 9月4日启动");
    expect(r.preflight.boundary.inScope).toBe(true);
  });

  it("越界拒绝: pure image generation routes to image Skill", () => {
    const r = run("帮我画一张科技感的海报");
    expect(r.preflight.status).toBe("out_of_scope");
    expect(r.preflight.boundary.suggestedSkill).toContain("图片");
  });

  it("输入不足: signal-bearing but too-short input asks a blocking clarification", () => {
    const r = run("活动");
    expect(r.preflight.proceed).toBe(false);
    expect(r.preflight.clarifications.some((c) => c.blocking)).toBe(true);
  });

  it("缺参数追问: submission intent without URL surfaces a non-blocking clarification but still proceeds", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止，记得尽快提交");
    expect(r.preflight.proceed).toBe(true);
    expect(r.preflight.clarifications.some((c) => c.field === "submission_url")).toBe(true);
    // still produces a card (no invented URL)
    expect(r.cardJson).not.toBeNull();
  });

  it("低置信标注: ambiguous intent (tie) flags low-confidence intent", () => {
    const r = run("AI先锋大赛 培训案例");
    expect(r.intent.confidence).toBeLessThan(0.65);
    const flagged = r.preflight.lowConfidence.some((f) => f.field === "intent");
    expect(flagged).toBe(true);
  });

  it("风险确认: wantSend without confirm requires confirmation", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com", { wantSend: true });
    const risk = r.preflight.risks.find((x) => x.action === "send_card");
    expect(risk?.requiresConfirmation).toBe(true);
  });

  it("风险确认: wantSend + confirmSend clears confirmation", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com", {
      wantSend: true,
      confirmSend: true,
    });
    const risk = r.preflight.risks.find((x) => x.action === "send_card");
    expect(risk?.requiresConfirmation).toBe(false);
  });

  it("in-scope healthy card proceeds with status ok", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com");
    expect(r.preflight.status).toBe("ok");
    expect(r.preflight.proceed).toBe(true);
  });
});
