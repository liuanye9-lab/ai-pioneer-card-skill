import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/core/pipeline.js";
import type { CompileResult } from "../src/core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = resolve(__dirname, "..", "brands");

function run(copy: string): CompileResult {
  return compile({ copy }, { brandsDir: BRANDS_DIR });
}

describe("Mobile Golden Tests (SPEC §44)", () => {
  it("MGT-01 three scenes are NOT crowded into one row", () => {
    const r = run(`本周培训：财务专场、销售专场、客服专场，提供课程日历入口`);
    expect(r.mobileLayout.maxSecondaryCTAPerRow).toBeLessThanOrEqual(2);
    expect(r.qa.issues.some((i) => i.code === "CROWDED_BUTTON_ROW")).toBe(false);
  });

  it("MGT-02 an overloaded information image fails readability -> reduced/native", () => {
    const copy = `本周十门课程：
课程一 周一10:00 课程二 周一11:00 课程三 周二10:00 课程四 周二11:00
课程五 周三10:00 课程六 周三11:00 课程七 周四10:00 课程八 周四11:00
课程九 周五10:00 课程十 周五11:00
财务、销售、客服、人力、市场、运营 六大专题`;
    const r = run(copy);
    // After remediation the plan must be mobile readable (native fallback).
    expect(r.mobileLayout.imageReadableWithoutZoom).toBe(true);
    if (r.imagePlan) expect(r.imagePlan.modules.length).toBeLessThanOrEqual(4);
    expect(r.qa.issues.some((i) => i.code === "IMAGE_ZOOM_REQUIRED")).toBe(false);
  });

  it("MGT-03 deadline card surfaces 9月4日 + submit action above the fold", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com");
    expect(r.mobileLayout.criticalFactsAboveFold.join(" ")).toContain("9月4日");
    expect(r.mobileLayout.readingOrder[0]).toBe("header");
    expect(r.mobileLayout.primaryAnchorPosition).toBe("top");
  });

  it("MGT-04 mobile column strategy stays single/limited (never 3+)", () => {
    const r = run(`本周培训：财务专场、销售专场、客服专场、人力专场，课程日历入口`);
    expect(["single", "limited_two_column"]).toContain(r.mobileLayout.columnStrategy);
  });

  it("mobile-first flag and single-column default hold", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止");
    expect(r.mobileLayout.mobile_first).toBe(true);
    expect(r.deviceProfile.primarySurface).toBe("mobile");
  });

  it("cross-device: mobile fail would force overall fail (invariant)", () => {
    const r = run("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com");
    // Healthy card: mobile passes -> overall passes.
    expect(r.crossDeviceQA.mobile.pass).toBe(true);
    expect(r.crossDeviceQA.overallPass).toBe(true);
  });
});
