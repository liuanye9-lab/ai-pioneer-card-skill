import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/core/pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = resolve(__dirname, "..", "brands");

/** Collect all human-visible text from a card. */
function cardText(cardJson: any): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (typeof n.content === "string") parts.push(n.content);
    if (n.text && typeof n.text.content === "string") parts.push(n.text.content);
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "object") walk(v);
    }
  };
  walk(cardJson);
  return parts.join("\n");
}

describe("date normalization end-to-end (no raw date leak)", () => {
  it("normalizes every date in a timeline card (8.20 -> 8月20日)", () => {
    const r = compile(
      {
        copy: `AI先锋大赛赛程：
8.20 报名启动
8.28 初赛作品提交
9.4 初赛评审
9.10 决赛路演`,
      },
      { brandsDir: BRANDS_DIR },
    );
    const text = cardText(r.cardJson);
    expect(text).toContain("8月20日");
    expect(text).toContain("8月28日");
    // No dotted raw date leaks into the rendered card.
    expect(text).not.toMatch(/\d{1,2}\.\d{1,2}/);
    expect(r.qa.issues.some((i) => i.code === "DATE_NOT_NORMALIZED")).toBe(false);
    expect(r.qa.hardFail).toBe(false);
  });

  it("badge never carries a raw sentence fragment", () => {
    const r = compile({ copy: "AI先锋大赛 8.20 报名启动" }, { brandsDir: BRANDS_DIR });
    const badge = r.structure.header.badge ?? "";
    expect(badge).not.toMatch(/\d{1,2}\.\d{1,2}/);
  });
});
