import { describe, it, expect } from "vitest";
import { generateFeishuCard, sendFeishuCard } from "../src/agent/tool-adapter.js";

/**
 * Locks in the multi-turn work-companion conversation behavior demonstrated by
 * scripts/agent-conversation.ts.
 */
describe("agent conversation flow", () => {
  it("turn 1: healthy submission card carries operation copy + preview", () => {
    const r = generateFeishuCard({
      copy: "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit 📣 记得不要错过",
    });
    expect(r.status).toBe("generated");
    expect(r.operation_copy?.before_send).toBeTruthy();
    expect(r.operation_copy?.deadline_reminder).toContain("9月4日");
    expect(Array.isArray(r.preview)).toBe(true);
  });

  it("turn 2: '初赛评审结果9月6日公布' classifies as result", () => {
    const r = generateFeishuCard({ copy: "初赛评审结果9月6日公布，让大家关注群通知" });
    expect(r.status).toBe("generated");
    expect(r.summary?.intent).toBe("result");
  });

  it("turn 3: poster request routes to the image Skill", () => {
    const r = generateFeishuCard({ copy: "帮我画一张AI先锋大赛的宣传海报，科技感强一点" });
    expect(r.status).toBe("out_of_scope");
    expect(r.suggested_skill).toContain("图片");
  });

  it("turn 5: confirmed send with no credentials stays Generated (never claims sent)", async () => {
    const gen = generateFeishuCard({
      copy: "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit",
      want_send: true,
    });
    expect(gen.risks?.some((x) => x.action === "send_card" && x.requires_confirmation)).toBe(true);
    const sent = await sendFeishuCard({ card_json: gen.card_json, chat_id: "oc_x", confirm: true });
    // Without credentials the send is honestly reported as not performed.
    expect(sent.ok).toBe(false);
    expect(["Generated", "Configured"]).toContain(sent.status);
  });
});
