import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/core/pipeline.js";
import { runFactQA } from "../src/qa/fact-qa.js";
import { parseSourceOfTruth } from "../src/parser/fact-parser.js";
import type { CompileResult } from "../src/core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = resolve(__dirname, "..", "brands");

function run(copy: string, brandName?: string, heroImageKey?: string): CompileResult {
  return compile({ copy, brandName, heroImageKey }, { brandsDir: BRANDS_DIR });
}

describe("Fixes 2026-08-29 (fact-safety & phantom CTA regression)", () => {
  it("FX-01 brand prefix is part of the activity name: 象上汇先锋大赛 ≠ 先锋大赛", () => {
    const r = run("象上汇先锋大赛决赛名单公布，9月10日路演，名单：https://example.com/finalists", "象上汇");
    expect(r.sourceOfTruth.activity_name).toBe("象上汇先锋大赛");
    expect(r.cardJson.header.title.content).toBe("象上汇先锋大赛");
  });

  it("FX-02 rewards survive into the card body even for submission intent", () => {
    const r = run(
      "AI先锋大赛作品提交通知：0809开始提交作品，8.15截止，提交地址 https://example.com/submit " +
        "大赛冠军奖品为最新款AI设备一台，参赛选手均可获得证书",
    );
    const text = JSON.stringify(r.cardJson);
    expect(text).toContain("冠军");
    expect(text).toContain("证书");
    expect(r.qa.issues.some((i) => i.code === "REWARD_DROPPED")).toBe(false);
    expect(r.qa.hardFail).toBe(false);
  });

  it("FX-03 a dropped reward is a hard fail, not a score deduction", () => {
    const sot = parseSourceOfTruth({ copy: "AI先锋大赛截止9月4日，冠军奖品为AI设备一台" });
    const check = runFactQA({
      sot,
      rawCopy: "AI先锋大赛截止9月4日，冠军奖品为AI设备一台",
      cardText: "AI先锋大赛 9月4日 截止",
      ctas: [],
    });
    const dropped = check.issues.find((i) => i.code === "REWARD_DROPPED");
    expect(dropped?.severity).toBe("hard_fail");
    expect(check.pass).toBe(false);
  });

  it("FX-04 no phantom module CTA outside navigation mode", () => {
    const r = run("AI先锋大赛决赛路演 9月10日 14:00 在总部大楼举行，📣 请入围选手准时参加");
    expect(r.renderMode.render_mode).not.toBe("image_led_navigation");
    expect(r.ctas.some((c) => c.label.includes("课程"))).toBe(false);
    expect(r.ctas.some((c) => c.mapsToImageModule)).toBe(false);
  });

  it("FX-05 bracket emoji labels upgrade at the source: [喇叭] -> 📣 in locked facts", () => {
    const sot = parseSourceOfTruth({ copy: "AI先锋大赛9月4日截止 [喇叭] 冠军奖品为AI设备一台" });
    for (const r of sot.rewards) {
      expect(r.value).toContain("📣");
      expect(r.value).not.toContain("[喇叭]");
      expect(r.value).not.toContain("【喇叭】");
    }
  });

  it("FX-06 a real heroImageKey renders a native img element; no key keeps native text", () => {
    const copy = "象上汇先锋大赛决赛名单公布，9月10日路演，名单：https://example.com/finalists";
    const withImg = run(copy, "象上汇", "img_key_demo");
    const imgEl = withImg.cardJson.body.elements.find((e: any) => e.tag === "img");
    expect(imgEl?.img_key).toBe("img_key_demo");

    const withoutImg = run(copy, "象上汇");
    expect(withoutImg.cardJson.body.elements.some((e: any) => e.tag === "img")).toBe(false);
  });
});
