import { describe, it, expect } from "vitest";
import { dedup, semanticSimilarity, type DedupCandidate } from "../src/dedup/semantic-deduper.js";

describe("semantic-deduper", () => {
  it("treats repeated deadline phrasings as similar", () => {
    const sim = semanticSimilarity("9月4日截止提交", "请9月4日前提交");
    expect(sim).toBeGreaterThan(0.4);
  });

  it("collapses multiple deadline expressions to one (AC-04)", () => {
    const candidates: DedupCandidate[] = [
      { id: "a", text: "9月4日截止提交", role: "body", priority: 10 },
      { id: "b", text: "请9月4日前提交", role: "body", priority: 5 },
      { id: "c", text: "作品9月4日停止提交", role: "body", priority: 3 },
    ];
    const { kept, removed } = dedup(candidates);
    expect(kept.length).toBe(1);
    expect(removed.length).toBe(2);
  });

  it("keeps same fact when functional role differs (body vs cta)", () => {
    const candidates: DedupCandidate[] = [
      { id: "body", text: "9月4日截止提交作品", role: "body", priority: 10 },
      { id: "cta", text: "提交作品", role: "cta", priority: 8 },
    ];
    const { kept } = dedup(candidates);
    expect(kept.length).toBe(2);
  });
});
