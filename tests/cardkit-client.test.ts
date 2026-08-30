import { afterEach, describe, expect, it, vi } from "vitest";
import { FeishuCardAdapter } from "../src/feishu/cardkit-client.js";
import { resetTokenCache } from "../src/feishu/auth.js";

const card = {
  schema: "2.0",
  config: { update_multi: true },
  header: { title: { tag: "plain_text", content: "Test" } },
  body: { elements: [{ tag: "markdown", content: "Body" }] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetTokenCache();
});

describe("FeishuCardAdapter", () => {
  it("includes the required increasing sequence field when updating a CardKit entity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, tenant_access_token: "test-token", expire: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, msg: "success", data: {} }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new FeishuCardAdapter({
      FEISHU_APP_ID: "test-app",
      FEISHU_APP_SECRET: "test-secret",
    });
    const result = await adapter.updateCard("7355372766134157313", card, 3);

    expect(result.ok).toBe(true);
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(request.body)).sequence).toBe(3);
  });
});
