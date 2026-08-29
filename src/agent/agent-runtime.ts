import {
  generateFeishuCard,
  sendFeishuCard,
  type AgentGenerateResult,
} from "./tool-adapter.js";

/**
 * Doubao work-companion agent RUNTIME.
 *
 * A stateful conversational controller for「飞书活动卡片助手」. It holds
 * per-session state (last card, pending clarification, pending send) and drives
 * the tool-calling loop that a豆包 bot would run, turning each user message
 * into (optional) tool calls + a natural persona reply.
 *
 * The turn router is deterministic and rule-based so it runs with zero external
 * dependencies (no LLM key needed). To use a real LLM instead, replace
 * `classifyTurn` with a model call that emits the same TurnPlan.
 */

// ---------------------------------------------------------------------------
// Public conversation types
// ---------------------------------------------------------------------------

export interface AgentReply {
  /** What the agent says to the user. */
  text: string;
  /** Tool calls the agent made this turn (for transparency / UI). */
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  /** Machine-readable result of the primary tool call, when any. */
  data?: AgentGenerateResult | { sent: boolean; status: string; message: string };
  /** True when the agent is waiting for a specific user answer. */
  awaiting?: "clarification" | "send_confirmation" | null;
}

export interface AgentRuntimeOptions {
  /** Group the companion is bound to (for confirmation copy). */
  chatName?: string;
  chatId?: string;
  brand?: string;
}

interface SessionState {
  lastCopy?: string;
  lastResult?: AgentGenerateResult;
  pendingSend?: { copy: string };
  pendingClarification?: { copy: string; field: string };
}

const INTENT_ZH: Record<string, string> = {
  submission: "作品提交",
  deadline: "截止提醒",
  timeline: "赛程时间线",
  training: "培训预告",
  case_showcase: "案例展示",
  announcement: "活动通知",
  registration: "报名",
  result: "结果公布",
  award: "奖项公布",
  reminder: "提醒",
  countdown: "倒计时",
  guide: "操作指南",
  custom: "自定义",
};

// ---------------------------------------------------------------------------
// Turn classification (LLM-swappable)
// ---------------------------------------------------------------------------

type TurnPlan =
  | { kind: "affirm" } // "确认发送" / "好" / "可以"
  | { kind: "deny" } // "先不发" / "取消"
  | { kind: "send_request" } // "发到群里" without prior card
  | { kind: "greeting" }
  | { kind: "card_copy" }; // treat the message as activity copy

const AFFIRM = /^(确认(发送)?|好的?|可以|发吧|发送|ok|yes|嗯|对|是的)[。!！~]*$/i;
const DENY = /^(先不发|不发了?|取消|等下|不用了|no)[。!！~]*$/i;
const SEND_REQUEST = /(发到|发去|发群|发到群|发本群|推送到|发出去)/;
const GREETING = /^(在吗|你好|hi|hello|你能做什么|怎么用|帮助)[？?。!！~]*$/i;

// Activity signals that mark a message as card COPY, not a bare send command.
const ACTIVITY_SIGNAL = /(\d{1,2}[.月/-]\d{1,2}|截止|报名|提交|培训|课程|大赛|活动|通知|名单|案例|奖|https?:\/\/)/;

function classifyTurn(message: string): TurnPlan {
  const m = message.trim();
  if (AFFIRM.test(m)) return { kind: "affirm" };
  if (DENY.test(m)) return { kind: "deny" };
  if (GREETING.test(m)) return { kind: "greeting" };
  // A short "发到群里" is a send request ONLY when it carries no activity signal;
  // otherwise "国庆活动发本群通知" (real copy) would be misrouted and dropped (D#6).
  if (SEND_REQUEST.test(m) && m.length < 20 && !ACTIVITY_SIGNAL.test(m)) return { kind: "send_request" };
  return { kind: "card_copy" };
}

// ---------------------------------------------------------------------------
// Reply rendering helpers
// ---------------------------------------------------------------------------

function renderGeneratedReply(r: AgentGenerateResult, brand?: string): string {
  const s = r.summary!;
  const lines: string[] = [];
  lines.push(`好了，这是一张「${INTENT_ZH[s.intent] ?? s.intent}」卡，第一眼看到的是：${s.primary_anchor}。`);
  const ctaTxt = s.ctas.length
    ? s.ctas.map((c) => `${c.priority === "primary" ? "【主】" : "【次】"}${c.label}`).join("、")
    : "（暂无按钮）";
  lines.push(`· 按钮：${ctaTxt}`);
  lines.push(
    `· 手机：${s.mobile_columns === "single" ? "单列、Primary 独占一行" : s.mobile_columns}｜QA ${s.qa_score}/100 ${s.qa_pass ? "✅" : "❌"}｜状态 ${s.publish_status}`,
  );
  for (const c of r.clarifications ?? []) lines.push(`· ⚠️ ${c.question}`);
  for (const f of r.low_confidence ?? []) lines.push(`· ℹ️ ${f.note}`);
  if (r.operation_copy) {
    lines.push(`—— 群运营话术（可直接复制）——`);
    lines.push(`发卡前：${r.operation_copy.before_send}`);
    lines.push(`发卡时：${r.operation_copy.on_send}`);
    if (r.operation_copy.deadline_reminder) lines.push(`截止提醒：${r.operation_copy.deadline_reminder}`);
  }
  lines.push(brand ? `（品牌视觉：${brand}）需要我发到群里就说“发到群里”。` : `需要我发到群里就说“发到群里”。`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Agent runtime
// ---------------------------------------------------------------------------

export class CardAgentRuntime {
  private state: SessionState = {};
  private opts: AgentRuntimeOptions;

  constructor(opts: AgentRuntimeOptions = {}) {
    this.opts = opts;
  }

  /** The opening line a fresh session shows. */
  greeting(): string {
    return "把活动文案发我，我给你出一张能直接发飞书群的卡片（手机优先、事实不改，还带运营话术）。比如：AI先锋大赛 9月4日作品提交截止，提交地址 https://... 📣 记得别错过";
  }

  reset(): void {
    this.state = {};
  }

  /** Drive one conversation turn. */
  async handle(message: string): Promise<AgentReply> {
    const plan = classifyTurn(message);

    // 1) If we're awaiting a send confirmation, interpret affirm/deny first.
    if (this.state.pendingSend) {
      if (plan.kind === "affirm") return this.doSend(this.state.pendingSend.copy);
      if (plan.kind === "deny") {
        this.state.pendingSend = undefined;
        return { text: "好，先不发。要改哪里，或者继续发别的文案都行。", toolCalls: [], awaiting: null };
      }
      // Any other message: drop the pending send and treat as new input.
      this.state.pendingSend = undefined;
    }

    // 2) If awaiting a clarification, merge the answer with the prior copy.
    if (this.state.pendingClarification && plan.kind === "card_copy") {
      const merged = mergeClarification(this.state.pendingClarification, message);
      this.state.pendingClarification = undefined;
      return this.generate(merged);
    }

    switch (plan.kind) {
      case "greeting":
        return { text: this.greeting(), toolCalls: [], awaiting: null };
      case "affirm":
        // Affirm with nothing pending: gently ask what to do.
        return { text: "好，需要我做张什么卡？把活动文案发我就行。", toolCalls: [], awaiting: null };
      case "deny":
        return { text: "好的。", toolCalls: [], awaiting: null };
      case "send_request":
        return this.handleSendRequest();
      case "card_copy":
      default:
        return this.generate(message);
    }
  }

  private generate(copy: string): AgentReply {
    const args = { copy, brand: this.opts.brand };
    const r = generateFeishuCard(args);
    // Only remember a card we can actually act on later. Overwriting with an
    // out-of-scope / needs-clarification result would discard a good prior card
    // and make a subsequent "发到群里" fail (state leak, D#7).
    if (r.status === "generated") {
      this.state.lastCopy = copy;
      this.state.lastResult = r;
    }

    const toolCalls = [{ name: "generate_feishu_card", args }];

    if (r.status === "out_of_scope") {
      return {
        text: `这个我不接——${r.message}${r.suggested_skill ? ` 建议用「${r.suggested_skill}」。` : ""} 如果你要的是“发群的活动卡”，把文案发我就行。`,
        toolCalls,
        data: r,
        awaiting: null,
      };
    }

    if (r.status === "needs_clarification") {
      const blocking = r.clarifications?.find((c) => c.blocking);
      if (blocking) this.state.pendingClarification = { copy, field: blocking.field };
      return {
        text: `我先确认一下再出卡：\n${(r.clarifications ?? []).map((c) => `· ${c.question}`).join("\n")}`,
        toolCalls,
        data: r,
        awaiting: "clarification",
      };
    }

    return { text: renderGeneratedReply(r, this.opts.brand), toolCalls, data: r, awaiting: null };
  }

  private handleSendRequest(): AgentReply {
    const last = this.state.lastResult;
    if (!last || last.status !== "generated" || !this.state.lastCopy) {
      return { text: "还没有可发送的卡片。先把活动文案发我，我出好卡你再说发。", toolCalls: [], awaiting: null };
    }
    // Ask for confirmation (risk gate) before sending.
    this.state.pendingSend = { copy: this.state.lastCopy };
    const anchor = last.summary?.primary_anchor ?? "这张卡";
    const where = this.opts.chatName ? `「${this.opts.chatName}」` : "本群";
    return {
      text: `发送前确认下：即将把「${INTENT_ZH[last.summary!.intent] ?? last.summary!.intent}（${anchor}）」发到${where}。确认就回“确认发送”，不发回“先不发”。`,
      toolCalls: [],
      awaiting: "send_confirmation",
    };
  }

  private async doSend(copy: string): Promise<AgentReply> {
    this.state.pendingSend = undefined;
    // Re-generate with confirmation so the risk gate is satisfied end-to-end.
    const gen = generateFeishuCard({ copy, brand: this.opts.brand, want_send: true, confirm_send: true });
    const toolCalls: AgentReply["toolCalls"] = [
      { name: "generate_feishu_card", args: { copy, want_send: true, confirm_send: true } },
    ];

    if (gen.status !== "generated" || !gen.card_json) {
      return { text: "发送前重建卡片失败了，麻烦把文案再发我一次。", toolCalls, awaiting: null };
    }

    // Fact-safety gate (D7): never send a hard-failed card.
    if (gen.summary?.hard_fail) {
      return {
        text: "这张卡有事实/合规硬错误，我不能发。请先修正内容（比如缺失的截止时间、被改动的名称或链接）后再发。",
        toolCalls,
        data: gen,
        awaiting: null,
      };
    }

    const chatId = this.opts.chatId ?? "";
    toolCalls.push({ name: "send_feishu_card", args: { chat_id: chatId || "(未配置)", confirm: true } });
    const sent = await sendFeishuCard({ card_json: gen.card_json, chat_id: chatId, confirm: true });

    let text: string;
    if (sent.status === "Generated") {
      text = "我这边没检测到飞书凭证，所以只完成到「Generated」：卡片已生成、未真实发送。配好 FEISHU_APP_ID/APP_SECRET（和目标 chat_id）后，这一步就会真的发出去并变成「Tested」。";
    } else if (sent.ok) {
      text = "✅ 已发送到群。";
    } else {
      text = `没能发出去：${sent.message}`;
    }
    return { text, toolCalls, data: { sent: sent.ok, status: sent.status, message: sent.message }, awaiting: null };
  }
}

/** Merge a user's clarification answer (e.g. a URL) back into the copy. */
function mergeClarification(pending: { copy: string; field: string }, answer: string): string {
  const url = answer.match(/https?:\/\/\S+/)?.[0];
  if (pending.field === "submission_url" && url) {
    return `${pending.copy}，提交地址：${url}`;
  }
  // Generic: append the answer as extra context.
  return `${pending.copy}。${answer}`;
}
