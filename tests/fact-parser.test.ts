import { describe, it, expect } from "vitest";
import { parseSourceOfTruth } from "../src/parser/fact-parser.js";
import { verifyFactLock } from "../src/parser/fact-locker.js";

const GOLDEN_COPY = `AI先锋大赛
9月4日作品提交截止
还没提交作品的小伙伴记得尽快提交
提交地址：https://example.com
作品提交将在9月4日截止
📣 大家记得不要错过`;

describe("fact-parser", () => {
  it("preserves AI先锋大赛 name verbatim (AC-01 / GT-01)", () => {
    const sot = parseSourceOfTruth({ copy: GOLDEN_COPY });
    expect(sot.activity_name).toBe("AI先锋大赛");
  });

  it("extracts normalized deadline 9月4日", () => {
    const sot = parseSourceOfTruth({ copy: GOLDEN_COPY });
    expect(sot.deadlines.length).toBeGreaterThan(0);
    expect(sot.deadlines[0].date).toBe("9月4日");
  });

  it("extracts the real submission URL and marks it locked", () => {
    const sot = parseSourceOfTruth({ copy: GOLDEN_COPY });
    const link = sot.links.find((l) => l.url === "https://example.com");
    expect(link).toBeTruthy();
    expect(link?.locked).toBe(true);
    expect(link?.type).toBe("submission");
  });

  it("does not fabricate URLs when none exist (AC-06)", () => {
    const sot = parseSourceOfTruth({ copy: "AI先锋大赛 9月4日作品提交截止，记得提交" });
    expect(sot.links.length).toBe(0);
  });

  it("captures raw source spans for traceability (AC-10)", () => {
    const sot = parseSourceOfTruth({ copy: GOLDEN_COPY });
    for (const d of sot.dates) expect(d.source_text.length).toBeGreaterThan(0);
  });
});

describe("fact-locker", () => {
  it("flags truncated activity name AI先锋大赛 -> 先锋大赛", () => {
    const sot = parseSourceOfTruth({ copy: GOLDEN_COPY });
    const res = verifyFactLock("先锋大赛 9月4日截止", sot);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === "ACTIVITY_NAME_TRUNCATED" || v.code === "ACTIVITY_NAME_MISSING")).toBe(true);
  });

  it("flags invented URLs", () => {
    const sot = parseSourceOfTruth({ copy: GOLDEN_COPY });
    const res = verifyFactLock("AI先锋大赛 9月4日 https://evil.example/fake", sot);
    expect(res.violations.some((v) => v.code === "INVENTED_URL")).toBe(true);
  });

  it("passes when locked facts are intact", () => {
    const sot = parseSourceOfTruth({ copy: GOLDEN_COPY });
    const res = verifyFactLock("AI先锋大赛 9月4日截止 https://example.com", sot);
    expect(res.ok).toBe(true);
  });
});
