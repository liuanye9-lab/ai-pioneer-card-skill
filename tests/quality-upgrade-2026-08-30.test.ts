import { describe, it, expect } from "vitest";
import { compile } from "../src/core/pipeline.js";
import { normalizeDatesInText } from "../src/normalize/date-normalizer.js";
import { dedup } from "../src/dedup/semantic-deduper.js";
import { upgradeBracketLabels } from "../src/normalize/emoji-preserver.js";

const opts = { env: process.env } as any;
function flat(copy: string, brand?: string) {
  const r: any = compile({ copy, brandName: brand }, opts);
  return { r, json: JSON.stringify(r.cardJson) };
}
function bodyMd(r: any): string[] {
  return (r.cardJson?.body?.elements ?? []).filter((e: any) => e.tag === "markdown").map((e: any) => e.content);
}

describe("2026-08-30 quality upgrade", () => {
  it("never rewrites a non-date numeric fact into a date (8.9万元 / 第8.15条)", () => {
    expect(normalizeDatesInText("冠军可获得8.9万元奖金").text).toBe("冠军可获得8.9万元奖金");
    expect(normalizeDatesInText("第8.15条规则").text).toBe("第8.15条规则");
    expect(normalizeDatesInText("会议室0809").text).toBe("会议室0809");
    expect(normalizeDatesInText("价格8.9元").text).toBe("价格8.9元");
    const { json } = flat("创新大赛：冠军可获得8.9万元奖金，第8.15条规则见 https://example.com/rule，8.20报名截止");
    expect(json.includes("8.9万")).toBe(true);
    expect(json.includes("8月9日万")).toBe(false);
  });

  it("does not fake a date from room/extension/order numbers (compact 4-digit)", () => {
    const { r } = flat("会议室0809开会，8月9日截止提交作品");
    const dates = r.sourceOfTruth.dates.map((d: any) => d.value);
    // The real date is kept; 0809 after 会议室 must NOT become 8月9日 via the compact path.
    expect(dates).toContain("8月9日");
    expect(dates.filter((d: string) => d === "8月9日").length).toBe(1);
    const { r: r2 } = flat("订单号1231已发货，赛程9月10日启动");
    expect(r2.sourceOfTruth.dates.map((d: any) => d.value)).not.toContain("12月31日");
  });

  it("does not fake dates from room/version/extension even with nearby context (parser parity)", () => {
    const d1 = flat("全场9.9折，会议室0809，报名参加活动 https://ex.com/s，9月4日截止").r;
    expect(d1.sourceOfTruth.dates.map((x: any) => x.value)).toEqual(["9月4日"]);
    const d2 = flat("系统版本8.9上线，分机8.9联系，9月4日截止提交").r;
    expect(d2.sourceOfTruth.dates.map((x: any) => x.value)).toEqual(["9月4日"]);
  });

  it("does not corrupt numeric RANGES adjoining a unit/ordinal into date ranges", () => {
    expect(normalizeDatesInText("售价8.9-8.15元").text).toBe("售价8.9-8.15元");
    expect(normalizeDatesInText("依据第8.9-8.15条").text).toBe("依据第8.9-8.15条");
    // a real schedule range still normalizes
    expect(normalizeDatesInText("报名8.9-8.15").text).toBe("报名8月9日—8月15日");
  });

  it("hard-fails / strips a raw URL that leaks into an editable body sentence", () => {
    const { r } = flat("AI先锋大赛 9月4日截止，记得尽快提交作品 https://ex.com/s 快来参加");
    const md = (r.cardJson?.body?.elements ?? []).filter((e: any) => e.tag === "markdown");
    expect(md.some((e: any) => /https?:\/\//.test(e.content))).toBe(false);
  });

  it("still normalizes real dates including full-width and ranges", () => {
    expect(normalizeDatesInText("0809开始，8.15截止").text).toBe("8月9日开始，8月15日截止");
    expect(normalizeDatesInText("８月９日开始").text).toBe("8月9日开始");
    expect(normalizeDatesInText("报名8.9-8.15").text).toBe("报名8月9日—8月15日");
  });

  it("splits reward + certificate into separate lines and strips inline URL", () => {
    const { r } = flat(
      "AI先锋大赛作品提交通知：0809开始提交作品，8.15截止，提交地址 https://example.com/submit 大赛冠军奖品为最新款AI设备一台，参赛选手均可获得证书 [喇叭]",
    );
    const md = bodyMd(r);
    // reward and certificate on separate paragraphs
    expect(md.some((m) => /AI设备/.test(m) && !/证书/.test(m))).toBe(true);
    expect(md.some((m) => /证书/.test(m) && !/AI设备/.test(m))).toBe(true);
    // no inline URL in any body markdown (link lives on the button)
    expect(md.some((m) => /https?:\/\//.test(m))).toBe(false);
  });

  it("emphasizes the deadline with color highlight, not just bold", () => {
    const { r } = flat("AI先锋大赛作品提交通知：8.15截止，提交地址 https://example.com/submit");
    const md = bodyMd(r);
    expect(md.some((m) => /<font color="red">\*\*.*截止/.test(m))).toBe(true);
  });

  it("uses emoji tastefully on key blocks without forcing it on every paragraph", () => {
    const { r } = flat("AI先锋大赛作品提交通知：0809开始提交作品，8.15截止，提交地址 https://example.com/submit 冠军奖AI设备，参赛得证书 [喇叭]");
    const md = bodyMd(r).filter((m) => !m.includes("\n"));
    const LEAD = /^\s*(?:<font[^>]*>)?\s*(?:\*\*)?\s*(?:[\p{Extended_Pictographic}\u2190-\u21FF\u2600-\u27BF●○✓📌]|[\u{1F000}-\u{1FAFF}])/u;
    const withEmoji = md.filter((m) => LEAD.test(m)).length;
    // Emoji should appear on some key blocks (anchor/reward/date), but the goal
    // is NOT one-per-line — a plain paragraph is allowed. Just assert emoji is
    // present somewhere and no leftover [喇叭] literal.
    expect(withEmoji).toBeGreaterThan(0);
    expect(JSON.stringify(r.cardJson).includes("[喇叭]")).toBe(false);
  });

  it("routes a multi-date schedule to the timeline intent and marks the deadline node", () => {
    const { r } = flat("AI先锋大赛赛程：8月20日启动报名，8月28日提交作品，9月4日截止，9月10日决赛路演");
    expect(r.intent.primary_intent).toBe("timeline");
    // deadline correctly identified as 9月4日 (nearest 截止), not the first date
    expect(r.sourceOfTruth.deadlines[0]?.date).toBe("9月4日");
  });

  it("surfaces multiple real links as multiple jump buttons (no invention)", () => {
    const { r } = flat("先锋大赛：报名 https://ex.com/reg 提交作品 https://ex.com/submit 规则 https://ex.com/doc，9月4日截止");
    const urls = new Set<string>();
    JSON.parse(JSON.stringify(r.cardJson)) &&
      (function walk(n: any) {
        if (!n || typeof n !== "object") return;
        if (n.tag === "button") for (const b of n.behaviors ?? []) if (b.default_url) urls.add(b.default_url);
        for (const v of Object.values(n)) if (typeof v === "object") walk(v);
      })(r.cardJson);
    expect(urls.size).toBeGreaterThanOrEqual(2);
    for (const u of urls) expect(u.startsWith("https://ex.com/")).toBe(true);
  });

  it("produces a lively opt-in operation copy variant with the real activity name", () => {
    const { r } = flat("AI先锋大赛作品提交通知：8.15截止，提交地址 https://example.com/submit");
    expect(r.operationCopy.beforeSendLively).toContain("AI先锋大赛");
    expect(/[！!]/.test(r.operationCopy.beforeSendLively)).toBe(true);
  });

  it("dedups reworded paraphrases (冠军≈第一名, 一万≈10000)", () => {
    const res = dedup([
      { id: "a", text: "冠军可获得10000元奖金", role: "body", priority: 2 },
      { id: "b", text: "第一名奖励一万元", role: "body", priority: 1 },
    ]);
    expect(res.kept.length).toBe(1);
  });

  it("upgrades a broader set of [label] shortcodes to emoji", () => {
    // Verified at the normalization source (every downstream fact inherits it).
    expect(upgradeBracketLabels("结果公布 [礼花] 恭喜 [鼓掌]")).toBe("结果公布 🎉 恭喜 👏");
    expect(upgradeBracketLabels("【火箭】冲 [点赞]")).toBe("🚀冲 👍");
    expect(upgradeBracketLabels("参赛得[证书]")).toBe("参赛得🎖️");
  });
});
