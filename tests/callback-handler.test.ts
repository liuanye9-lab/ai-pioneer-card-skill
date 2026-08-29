import { describe, it, expect } from "vitest";
import { CardCallbackHandler } from "../src/feishu/callback-handler.js";

function req(body: object, headers: Record<string, string> = {}) {
  return { headers, rawBody: JSON.stringify(body) };
}

describe("CardCallbackHandler", () => {
  it("answers url_verification challenge", async () => {
    const h = new CardCallbackHandler();
    const r = await h.handle(req({ type: "url_verification", challenge: "abc" }));
    expect(r.ok).toBe(true);
    expect(r.response.challenge).toBe("abc");
  });

  it("rejects invalid JSON payload", async () => {
    const h = new CardCallbackHandler();
    const r = await h.handle({ headers: {}, rawBody: "{not json" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("INVALID_PAYLOAD");
  });

  it("dispatches a valid action once and dedupes duplicate clicks", async () => {
    const h = new CardCallbackHandler({
      dispatch: () => ({ toast: { type: "success", content: "已提交" } }),
    });
    const payload = { event_id: "evt-1", action: { value: { key: "submit" } }, timestamp: String(Date.now()) };
    const first = await h.handle(req(payload));
    expect(first.ok).toBe(true);
    const second = await h.handle(req(payload));
    expect(second.code).toBe("DUPLICATE_CLICK");
  });

  it("flags expired actions", async () => {
    const h = new CardCallbackHandler({ maxActionAgeMs: 1000 });
    const old = String(Date.now() - 60_000);
    const r = await h.handle(req({ event_id: "evt-old", timestamp: old, action: {} }));
    expect(r.code).toBe("EXPIRED_ACTION");
  });

  it("rejects verification token mismatch", async () => {
    const h = new CardCallbackHandler({ verificationToken: "correct" });
    const r = await h.handle(req({ token: "wrong", event_id: "x", timestamp: String(Date.now()) }));
    expect(r.code).toBe("PERMISSION_ERROR");
  });

  it("maps dispatch errors to categories", async () => {
    const h = new CardCallbackHandler({ dispatch: () => { throw new Error("network fetch failed"); } });
    const r = await h.handle(req({ event_id: "e2", timestamp: String(Date.now()) }));
    expect(r.code).toBe("NETWORK_ERROR");
  });
});
