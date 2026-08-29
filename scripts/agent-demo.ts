import { dispatchTool } from "../src/agent/tool-adapter.js";

/**
 * Local demo of the豆包 agent tool-call loop (no LLM needed): simulates the
 * function calls the agent would emit for a few user turns, printing the
 * agent-facing tool results. Run: npx tsx scripts/agent-demo.ts
 */

async function turn(title: string, tool: string, args: any) {
  console.log(`\n──── ${title} ────`);
  console.log(`→ call ${tool}(${JSON.stringify(args).slice(0, 80)}${JSON.stringify(args).length > 80 ? "…" : ""})`);
  const res = await dispatchTool(tool, args);
  // Compact print (omit full card_json for readability).
  const { card_json, ...rest } = res;
  console.log("← result:", JSON.stringify(rest, null, 2));
  if (card_json) console.log(`  (card_json: ${JSON.stringify(card_json).length} chars, schema=${card_json.schema})`);
  return res;
}

async function main() {
  // 1) Healthy submission card.
  await turn(
    "生成提交卡（正常）",
    "generate_feishu_card",
    { copy: "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit 📣 记得不要错过" },
  );

  // 2) Out-of-scope: long-form writing -> route to another Skill.
  await turn("越界：长文写作", "generate_feishu_card", { copy: "帮我写一篇关于团队协作的公众号文章" });

  // 3) Missing param: submission without URL -> non-blocking clarification.
  await turn("缺 URL 追问", "generate_feishu_card", { copy: "AI先锋大赛 9月4日作品提交截止，记得尽快提交" });

  // 4) Risk confirmation: want_send without confirm.
  await turn("发送风险确认", "generate_feishu_card", {
    copy: "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit",
    want_send: true,
  });

  // 5) Send without confirm -> refused.
  await turn("未确认发送被拒", "send_feishu_card", {
    card_json: { schema: "2.0" },
    chat_id: "oc_demo",
    confirm: false,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
