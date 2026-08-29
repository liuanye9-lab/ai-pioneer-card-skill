import { generateFeishuCard, sendFeishuCard, type AgentGenerateResult } from "../src/agent/tool-adapter.js";

/**
 * 「飞书活动卡片助手」豆包工作伙伴 — 多轮对话效果演示（无需 LLM）。
 *
 * 用确定性逻辑扮演智能体：根据工具返回的 status / clarifications / risks
 * 组织"像人一样"的回复，展示嵌入 Skill 后的真实对话效果。
 * Run: npm run agent:conversation
 */

const line = "─".repeat(64);
function user(text: string) {
  console.log(`\n${line}\n👤 运营同学：${text}`);
}
function bot(text: string) {
  console.log(`🤖 卡片助手：${text}`);
}
function toolCall(name: string, args: Record<string, unknown>) {
  const s = JSON.stringify(args);
  console.log(`   ⚙️  调用 ${name}(${s.length > 70 ? s.slice(0, 70) + "…" : s})`);
}

/** Render the agent's spoken reply from a generate result. */
function speakGenerated(r: AgentGenerateResult): void {
  const s = r.summary!;
  const intentZh: Record<string, string> = {
    submission: "作品提交", deadline: "截止提醒", timeline: "赛程时间线", training: "培训预告",
    case_showcase: "案例展示", announcement: "活动通知", result: "结果公布", award: "奖项公布",
    registration: "报名", reminder: "提醒", countdown: "倒计时", guide: "操作指南", custom: "自定义",
  };
  bot(`好了，这是一张「${intentZh[s.intent] ?? s.intent}」卡，第一眼看到的是：${s.primary_anchor}。`);
  const ctaTxt = s.ctas.length
    ? s.ctas.map((c) => `${c.priority === "primary" ? "【主】" : "【次】"}${c.label}`).join("、")
    : "（暂无按钮）";
  console.log(`        按钮：${ctaTxt}`);
  console.log(`        手机布局：${s.mobile_columns === "single" ? "单列、Primary 独占一行" : s.mobile_columns} ｜ QA ${s.qa_score}/100 ${s.qa_pass ? "✅通过" : "❌需重做"} ｜ 状态 ${s.publish_status}`);
  if (r.clarifications?.length) {
    for (const c of r.clarifications) console.log(`        ⚠️ ${c.question}`);
  }
  if (r.low_confidence?.length) {
    for (const f of r.low_confidence) console.log(`        ℹ️ ${f.note}`);
  }
  if (r.operation_copy) {
    console.log(`        —— 顺手给你配好群运营话术 ——`);
    console.log(`        发卡前：${r.operation_copy.before_send}`);
    console.log(`        发卡时：${r.operation_copy.on_send}`);
    if (r.operation_copy.deadline_reminder) console.log(`        截止提醒：${r.operation_copy.deadline_reminder}`);
  }
}

async function main() {
  console.log("＝＝＝ 群：AI先锋大赛运营群 ｜ 工作伙伴：飞书活动卡片助手 ＝＝＝");
  bot("把活动文案发我，我给你出一张能直接发群的飞书卡片（手机优先、事实不改、还带运营话术）。");

  // 轮 1：正常出卡
  const t1 = "AI先锋大赛 9月4日作品提交截止，提交地址：https://example.com/submit 📣 记得不要错过";
  user(t1);
  toolCall("generate_feishu_card", { copy: t1 });
  const r1 = generateFeishuCard({ copy: t1 });
  speakGenerated(r1);

  // 轮 2：缺链接 → 追问；用户补链接 → 重出
  const t2 = "再帮我做一张：初赛评审结果9月6日公布，让大家关注群通知";
  user(t2);
  toolCall("generate_feishu_card", { copy: t2 });
  const r2 = generateFeishuCard({ copy: t2 });
  speakGenerated(r2);

  // 轮 3：越界（纯做图）→ 转其他 Skill
  const t3 = "帮我画一张AI先锋大赛的宣传海报，科技感强一点";
  user(t3);
  toolCall("generate_feishu_card", { copy: t3 });
  const r3 = generateFeishuCard({ copy: t3 });
  if (r3.status === "out_of_scope") {
    bot(`这个我不接——${r3.message} 建议用「${r3.suggested_skill}」。如果你要的是"带海报的活动通知卡"，把文案给我，我出卡、图片位我留好。`);
  } else if (r3.status === "generated") {
    bot(`我理解成"带主视觉的活动卡"了：${r3.summary!.primary_anchor}。如果你只想要一张纯海报图，那得换「图片生成」助手。`);
  } else {
    bot(`这个信息我还不确定要不要出卡，帮我说清是"发群的卡片"还是"单纯一张图"？`);
  }

  // 轮 4：图文导航卡（多专场）
  const t4 = "本周两个培训系列：飞书直播大班课 周一到周五15:00-16:00；豆包工作系列 周一到周五14:00-15:00，分财务/销售/客服专场，课程日历 https://example.com/cal";
  user(t4);
  toolCall("generate_feishu_card", { copy: t4 });
  const r4 = generateFeishuCard({ copy: t4 });
  speakGenerated(r4);

  // 轮 5：要求发送 → 风险确认 → 确认后发送
  user("第一张提交卡就发到本群吧");
  toolCall("generate_feishu_card", { copy: t1, want_send: true });
  const r5 = generateFeishuCard({ copy: t1, want_send: true });
  const risk = r5.risks?.find((x) => x.action === "send_card");
  if (risk?.requires_confirmation) {
    bot(`发送前确认下：即将把「作品提交（9月4日截止）」这张卡发到「AI先锋大赛运营群」。确认就回复"确认发送"。`);
  }
  user("确认发送");
  toolCall("send_feishu_card", { chat_id: "oc_ai_pioneer_ops", confirm: true });
  const sent = await sendFeishuCard({ card_json: r5.card_json, chat_id: "oc_ai_pioneer_ops", confirm: true });
  if (sent.status === "Generated") {
    bot(`我这边没检测到飞书凭证，所以只完成到「Generated」（卡片已生成、未真实发送）。配好 FEISHU_APP_ID/APP_SECRET 后，同样这步就会真的发出去并变成「Tested」。`);
  } else {
    bot(`发送结果：${sent.ok ? "✅ 已发送" : "❌ 未发送"} — ${sent.message}`);
  }

  console.log(`\n${line}\n（演示结束）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
