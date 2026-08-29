import { describe, it, expect } from "vitest";
import { normalizeDateToken, normalizeDatesInText } from "../src/normalize/date-normalizer.js";

describe("date-normalizer", () => {
  it("normalizes compact 0809 -> 8月9日 (AC-02)", () => {
    expect(normalizeDateToken("0809")?.normalized).toBe("8月9日");
  });

  it("normalizes 8.9 / 08/09 / 8/9 / 8-9 -> 8月9日", () => {
    expect(normalizeDateToken("8.9")?.normalized).toBe("8月9日");
    expect(normalizeDateToken("08/09")?.normalized).toBe("8月9日");
    expect(normalizeDateToken("8/9")?.normalized).toBe("8月9日");
    expect(normalizeDateToken("8-9")?.normalized).toBe("8月9日");
  });

  it("keeps 8月9日 canonical", () => {
    expect(normalizeDateToken("8月9日")?.normalized).toBe("8月9日");
    expect(normalizeDateToken("8月9")?.normalized).toBe("8月9日");
  });

  it("normalizes ranges 8.9-8.15 -> 8月9日—8月15日", () => {
    expect(normalizeDateToken("8.9-8.15")?.normalized).toBe("8月9日—8月15日");
    expect(normalizeDateToken("8月9日至8月15日")?.normalized).toBe("8月9日—8月15日");
  });

  it("rejects invalid months/days", () => {
    expect(normalizeDateToken("13.40")).toBeNull();
    expect(normalizeDateToken("99")).toBeNull();
  });

  it("does not invent a year", () => {
    const r = normalizeDateToken("8月9日");
    expect(r?.normalized).not.toMatch(/年/);
  });

  it("replaces dates inside free text", () => {
    const { text } = normalizeDatesInText("作品提交将在9月4日截止，8.9开营");
    expect(text).toContain("9月4日");
    expect(text).toContain("8月9日");
  });
});
