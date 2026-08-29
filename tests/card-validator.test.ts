import { describe, it, expect } from "vitest";
import { validateCardJson } from "../src/renderer/card-validator.js";

describe("card-validator (Card JSON 2.0)", () => {
  it("accepts a minimal valid card", () => {
    const card = {
      schema: "2.0",
      header: { title: { tag: "plain_text", content: "AI先锋大赛" }, template: "blue" },
      body: { elements: [{ tag: "markdown", content: "**9月4日截止**" }] },
    };
    const r = validateCardJson(card);
    expect(r.valid).toBe(true);
  });

  it("rejects wrong schema version", () => {
    const r = validateCardJson({ schema: "1.0", header: {}, body: { elements: [] } });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/schema/);
  });

  it("rejects a button without a behavior target", () => {
    const card = {
      schema: "2.0",
      header: { title: { tag: "plain_text", content: "T" } },
      body: { elements: [{ tag: "button", text: { tag: "plain_text", content: "提交作品" }, behaviors: [{ type: "open_url" }] }] },
    };
    const r = validateCardJson(card);
    expect(r.valid).toBe(false);
  });

  it("rejects an img without img_key", () => {
    const card = {
      schema: "2.0",
      header: { title: { tag: "plain_text", content: "T" } },
      body: { elements: [{ tag: "img", alt: { tag: "plain_text", content: "x" } }] },
    };
    const r = validateCardJson(card);
    expect(r.valid).toBe(false);
  });

  it("validates a two-column button set", () => {
    const card = {
      schema: "2.0",
      header: { title: { tag: "plain_text", content: "T" } },
      body: {
        elements: [
          {
            tag: "column_set",
            columns: [
              { tag: "column", elements: [{ tag: "button", text: { tag: "plain_text", content: "财务专场" }, behaviors: [{ type: "callback", value: { key: "a" } }] }] },
              { tag: "column", elements: [{ tag: "button", text: { tag: "plain_text", content: "销售专场" }, behaviors: [{ type: "callback", value: { key: "b" } }] }] },
            ],
          },
        ],
      },
    };
    const r = validateCardJson(card);
    expect(r.valid).toBe(true);
  });
});
