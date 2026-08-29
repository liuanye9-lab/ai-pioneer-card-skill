import { describe, it, expect } from "vitest";
import {
  assertEmojiFidelity,
  detectEmojiTextualization,
  upgradeBracketLabels,
  extractEmojis,
} from "../src/normalize/emoji-preserver.js";

describe("emoji-preserver", () => {
  it("detects 📣 -> 【喇叭】 textualization (AC-03)", () => {
    const offenders = detectEmojiTextualization("📣 AI先锋大赛", "【喇叭】 AI先锋大赛");
    expect(offenders).toContain("【喇叭】");
  });

  it("passes when emoji preserved verbatim", () => {
    const { ok } = assertEmojiFidelity("📣 AI先锋大赛", "📣 还没提交的同学注意");
    expect(ok).toBe(true);
  });

  it("fails fidelity when source emoji textualized", () => {
    const { ok, offenders } = assertEmojiFidelity("📣 通知", "[喇叭] 通知");
    expect(ok).toBe(false);
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("upgrades bracket labels to emoji only", () => {
    expect(upgradeBracketLabels("【喇叭】开赛")).toBe("📣开赛");
  });

  it("extracts emoji characters", () => {
    expect(extractEmojis("📣📅⏰ text")).toEqual(["📣", "📅", "⏰"]);
  });
});
