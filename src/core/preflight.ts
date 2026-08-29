import type {
  RawInput,
  SourceOfTruth,
  CardIntentResult,
  ImageIntentResult,
  PreflightResult,
  Clarification,
  LowConfidenceFlag,
  BoundaryDecision,
  RiskConfirmation,
} from "./types.js";

/**
 * Preflight (兜底层 / Fallback Layer — 图: C. 兜底层).
 *
 * Runs BEFORE rendering to make exceptions controllable:
 *   - 越界拒绝 / 转其他 Skill  (boundary)
 *   - 缺参数追问 / 输入不足追问 (clarifications)
 *   - 低置信标注               (lowConfidence)
 *   - 风险确认                 (risks — e.g. real send)
 *   - 依赖/工具失败降级         (degradations — recorded)
 *
 * It never invents facts. When blocking clarifications exist or the input is
 * out of scope, `proceed` is false and callers should ask the user first.
 */

// Signals that the input is NOT a card task and should route elsewhere.
const OUT_OF_SCOPE_RULES: Array<{ test: RegExp; skill: string; why: string }> = [
  { test: /(写|生成|起草|来).{0,12}(文章|文档|周报|方案|邮件|长文|小作文|公众号)/, skill: "文档写作 Skill", why: "这是长文写作需求，不是飞书卡片。" },
  { test: /(画|生成|做|设计).{0,16}(图片|插画|海报|logo|头像|封面图)(?!.*卡片)/i, skill: "图片生成 Skill", why: "这是纯图片/海报生成需求。" },
  { test: /^(什么是|为什么|怎么理解|解释一下|如何看待|介绍一下)/, skill: "问答 / 知识 Skill", why: "这是开放问答，不是卡片生成。" },
  { test: /(建|创建|新建|拉).{0,4}(日程|会议|日历事件)(?!.*卡片)/, skill: "日历 Skill", why: "这是日程创建需求。" },
  { test: /(建|新建|录入|更新).{0,6}(多维表|表格|bitable)(?!.*卡片)/i, skill: "多维表 Skill", why: "这是多维表数据操作需求。" },
];

function decideBoundary(input: RawInput, sot: SourceOfTruth): BoundaryDecision {
  const copy = (input.copy ?? "").trim();

  // Explicit "卡片" mention means the user wants a card — in scope regardless
  // of other keywords. Use a word boundary for the English "card" so substrings
  // like postcard/discard/wildcard don't falsely mark it in-scope (D#8).
  const explicitCard = /卡片/.test(copy) || /\bcard\b/i.test(copy);

  // Explicit out-of-scope phrasings.
  if (!explicitCard) {
    for (const rule of OUT_OF_SCOPE_RULES) {
      if (rule.test.test(copy)) {
        return { inScope: false, reason: rule.why, suggestedSkill: rule.skill };
      }
    }
  }

  // Heuristic: a card task should carry at least one activity signal
  // (a name, a date, a deadline, an action, a link, or an event keyword).
  const hasSignal =
    !!sot.activity_name ||
    sot.dates.length > 0 ||
    sot.deadlines.length > 0 ||
    sot.actions.length > 0 ||
    sot.links.length > 0 ||
    sot.times.length > 0 ||
    /活动|通知|培训|课程|报名|提交|赛|公布|名单|案例|截止/.test(copy);

  if (!hasSignal) {
    return {
      inScope: false,
      reason: "未识别到任何活动/通知/时间/行动信号，判定不属于飞书活动卡片场景。",
      suggestedSkill: "问答 / 通用助手",
    };
  }

  return { inScope: true, reason: "识别到活动/通知类信号，属于飞书卡片生成场景。" };
}

function collectClarifications(
  input: RawInput,
  sot: SourceOfTruth,
  intent: CardIntentResult,
): Clarification[] {
  const out: Clarification[] = [];
  const copy = (input.copy ?? "").trim();

  // 输入不足：文案过短且几乎无事实。
  const factCount =
    sot.dates.length + sot.deadlines.length + sot.actions.length + sot.links.length + sot.times.length;
  if (copy.length < 8 && factCount === 0) {
    out.push({
      field: "copy",
      question: "这段文案信息太少，请补充：这是什么活动、关键时间、以及希望用户做什么？",
      reason: "无法从过短的输入中稳定提取事实。",
      blocking: true,
    });
  }

  // 缺参数：submission/registration 意图但没有可用 URL。
  const needsUrlIntents = ["submission", "registration"];
  if (needsUrlIntents.includes(intent.primary_intent) && sot.links.length === 0) {
    out.push({
      field: "submission_url",
      question: `检测到「${intent.primary_intent === "submission" ? "作品提交" : "报名"}」意图，但没有可用链接。请提供真实入口 URL（没有的话我不会编造链接，按钮会省略）。`,
      reason: "提交/报名类卡片的核心行动依赖真实入口，禁止编造 URL。",
      blocking: false,
    });
  }

  // 缺参数：deadline 意图但没有日期。
  if (intent.primary_intent === "deadline" && sot.deadlines.length === 0 && sot.dates.length === 0) {
    out.push({
      field: "deadline",
      question: "这是截止类卡片，但没解析到具体截止日期，请补充截止时间。",
      reason: "截止卡的第一视觉是截止时间，缺失则无法成立。",
      blocking: true,
    });
  }

  // 缺参数：想发送但没有目标 chat。
  if (input.wantSend && !input.publishTarget?.chatId) {
    out.push({
      field: "chat_id",
      question: "要真实发送的话，请提供目标 chat_id（或配置 FEISHU_DEFAULT_CHAT_ID）。",
      reason: "发送需要明确的接收方。",
      blocking: false,
    });
  }

  return out;
}

function collectLowConfidence(
  sot: SourceOfTruth,
  intent: CardIntentResult,
  imageIntent: ImageIntentResult,
): LowConfidenceFlag[] {
  const flags: LowConfidenceFlag[] = [];

  if (intent.confidence < 0.65) {
    flags.push({
      field: "intent",
      value: intent.primary_intent,
      confidence: intent.confidence,
      note: "卡片意图置信度偏低，已按保守 announcement 处理；建议人工确认意图。",
    });
  }

  for (const u of sot.uncertain_information) {
    flags.push({ field: "uncertain_information", note: u.note });
  }

  if (!sot.activity_name) {
    flags.push({
      field: "activity_name",
      note: "未能明确识别活动名称，Header 使用了兜底文案，建议补充。",
    });
  }

  if (imageIntent.image_mode === "required" && imageIntent.image_role === "none") {
    flags.push({ field: "image", note: "图片被判定为必需但未能规划角色，已降级为文字承载。" });
  }

  return flags;
}

function collectRisks(input: RawInput): RiskConfirmation[] {
  const risks: RiskConfirmation[] = [];
  if (input.wantSend) {
    risks.push({
      action: "send_card",
      message: "即将向飞书群/用户真实发送卡片。发送是对外动作，请确认内容与接收方无误。",
      requiresConfirmation: !input.confirmSend,
    });
  }
  return risks;
}

export function runPreflight(input: {
  raw: RawInput;
  sot: SourceOfTruth;
  intent: CardIntentResult;
  imageIntent: ImageIntentResult;
  degradations?: string[];
}): PreflightResult {
  const { raw, sot, intent, imageIntent } = input;
  const degradations = input.degradations ?? [];

  const boundary = decideBoundary(raw, sot);
  const clarifications = boundary.inScope ? collectClarifications(raw, sot, intent) : [];
  const lowConfidence = boundary.inScope ? collectLowConfidence(sot, intent, imageIntent) : [];
  const risks = collectRisks(raw);

  const hasBlocking = clarifications.some((c) => c.blocking);

  let status: PreflightResult["status"] = "ok";
  if (!boundary.inScope) status = "out_of_scope";
  else if (hasBlocking) status = "needs_clarification";

  // proceed: in-scope AND no blocking clarification. (Non-blocking追问 and
  // low-confidence do not stop generation — they are surfaced alongside it.)
  const proceed = boundary.inScope && !hasBlocking;

  return { status, boundary, clarifications, lowConfidence, risks, degradations, proceed };
}
