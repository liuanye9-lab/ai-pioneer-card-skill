import { describe, it, expect } from "vitest";
import { CardAgentRuntime } from "../src/agent/agent-runtime.js";

describe("CardAgentRuntime (stateful work companion)", () => {
  it("greets and generates a card from activity copy", async () => {
    const agent = new CardAgentRuntime({ chatName: "运营群" });
    expect(agent.greeting()).toContain("活动文案");
    const r = await agent.handle("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit");
    expect(r.toolCalls[0].name).toBe("generate_feishu_card");
    expect(r.text).toContain("作品提交");
    expect(r.text).toContain("发卡前");
  });

  it("keeps context across a missing-URL clarification follow-up", async () => {
    const agent = new CardAgentRuntime();
    const r1 = await agent.handle("AI先锋大赛 报名今天开始，名额有限"); // registration w/o url
    // registration without URL surfaces a clarification (non-blocking) OR asks.
    // Provide the URL next turn; agent should merge and regenerate.
    const r2 = await agent.handle("https://example.com/signup");
    expect(r2.toolCalls[0].name).toBe("generate_feishu_card");
    const arg = r2.toolCalls[0].args.copy as string;
    expect(arg).toContain("https://example.com/signup");
    void r1;
  });

  it("routes out-of-scope requests to another Skill (no card)", async () => {
    const agent = new CardAgentRuntime();
    const r = await agent.handle("帮我画一张宣传海报，科技感强一点");
    expect(r.text).toContain("图片");
    expect((r.data as any)?.status).toBe("out_of_scope");
  });

  it("send flow: request -> confirm -> honest Generated without credentials", async () => {
    const agent = new CardAgentRuntime({ chatName: "运营群" });
    await agent.handle("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit");
    const ask = await agent.handle("发到群里");
    expect(ask.awaiting).toBe("send_confirmation");
    expect(ask.text).toContain("确认");
    const done = await agent.handle("确认发送");
    const names = done.toolCalls.map((t) => t.name);
    expect(names).toContain("send_feishu_card");
    // No credentials in test env => never claims sent.
    expect(done.text).toMatch(/Generated|未.*发送/);
  });

  it("send request before any card is produced is refused gracefully", async () => {
    const agent = new CardAgentRuntime();
    const r = await agent.handle("发到群里");
    expect(r.text).toContain("还没有");
  });

  it("declining a pending send cancels it", async () => {
    const agent = new CardAgentRuntime();
    await agent.handle("AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit");
    await agent.handle("发到群里");
    const r = await agent.handle("先不发");
    expect(r.awaiting).toBeNull();
    expect(r.text).toContain("先不发");
  });
});
