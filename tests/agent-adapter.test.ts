import { describe, it, expect } from "vitest";
import {
  createCardkitDraft,
  generateFeishuCard,
  sendFeishuCard,
  validateFeishuCard,
  dispatchTool,
} from "../src/agent/tool-adapter.js";

describe("Doubao agent tool-adapter", () => {
  it("generate_feishu_card returns a card + summary for a healthy input", () => {
    const r = generateFeishuCard({ copy: "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit" });
    expect(r.status).toBe("generated");
    expect(r.card_json.schema).toBe("2.0");
    expect(r.summary?.intent).toBe("submission");
    expect(r.summary?.qa_pass).toBe(true);
  });

  it("routes out-of-scope input to a suggested skill (no card)", () => {
    const r = generateFeishuCard({ copy: "帮我写一篇公众号长文" });
    expect(r.status).toBe("out_of_scope");
    expect(r.suggested_skill).toBeTruthy();
    expect(r.card_json).toBeUndefined();
  });

  it("surfaces a non-blocking clarification when a submission URL is missing", () => {
    const r = generateFeishuCard({ copy: "AI先锋大赛 9月4日作品提交截止，记得尽快提交" });
    expect(r.status).toBe("generated");
    expect(r.clarifications?.some((c) => c.field === "submission_url")).toBe(true);
  });

  it("send_feishu_card refuses without confirmation", async () => {
    const r = await sendFeishuCard({ card_json: { schema: "2.0" }, chat_id: "oc_x", confirm: false });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("confirm");
  });

  it("validate_feishu_card validates structure offline", async () => {
    const r = await validateFeishuCard({
      card_json: {
        schema: "2.0",
        header: { title: { tag: "plain_text", content: "T" } },
        body: { elements: [{ tag: "markdown", content: "x" }] },
      },
    });
    expect(r.valid).toBe(true);
  });

  it("dispatchTool routes by tool name", async () => {
    const r = await dispatchTool("generate_feishu_card", { copy: "AI先锋大赛 9月4日作品提交截止" });
    expect(r.status).toBe("generated");
    const unknown = await dispatchTool("nope", {});
    expect(unknown.error).toBeTruthy();
  });

  it("requires the host image step instead of silently creating a text-only CardKit draft", async () => {
    const previousUrl = process.env.IMAGE_API_URL;
    const previousBase = process.env.IMAGE_PROVIDER_BASE_URL;
    delete process.env.IMAGE_API_URL;
    delete process.env.IMAGE_PROVIDER_BASE_URL;
    try {
      const r = await createCardkitDraft({
        copy: "AI先锋大赛正式启动，9月4日开放报名，报名入口 https://example.com/signup",
        transport: "lark_cli",
      });
      expect(r.status).toBe("needs_image");
      expect(r.image_status?.delegate_prompt).toBeTruthy();
      expect(r.image_status?.delegate_size).toBeTruthy();
      expect(r.cardkit?.created).toBe(false);
    } finally {
      if (previousUrl) process.env.IMAGE_API_URL = previousUrl;
      if (previousBase) process.env.IMAGE_PROVIDER_BASE_URL = previousBase;
    }
  });

  it("applies explicit verified brand tokens to the generated image prompt", async () => {
    const r = await createCardkitDraft({
      copy: "AI先锋大赛正式启动，9月4日开放报名，报名入口 https://example.com/signup",
      brand: "示例品牌",
      brand_theme: {
        identity: "示例品牌官方主题",
        primaryColor: "#101010",
        accentColor: "#00A870",
        surfaceColor: "#FFFFFF",
        visualDirection: "minimal monochrome editorial",
      },
      transport: "lark_cli",
    });
    expect(r.status).toBe("needs_image");
    expect(r.image_status?.delegate_prompt).toContain("#101010");
    expect(r.image_status?.delegate_prompt).toContain("minimal monochrome editorial");
  });
});
