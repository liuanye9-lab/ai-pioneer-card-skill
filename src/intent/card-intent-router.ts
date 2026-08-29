import type { SourceOfTruth, CardIntent, CardIntentResult } from "../core/types.js";

/**
 * Card Intent Router (PRD §9.6, SPEC §9, SKILL §9).
 *
 * Classifies the card's primary intent BEFORE any layout decision. Scoring is
 * signal-based over the Source of Truth + raw copy. On low confidence we fall
 * back to a conservative `announcement` intent rather than inventing meaning.
 */

interface IntentSignal {
  intent: CardIntent;
  score: number;
}

const LAYOUT_BY_INTENT: Record<CardIntent, string> = {
  timeline: "vertical_timeline",
  deadline: "deadline_focus",
  training: "training_detail",
  submission: "submission_focus",
  case_showcase: "case_navigation",
  announcement: "announcement_hero",
  registration: "registration_focus",
  result: "result_list",
  award: "award_highlight",
  reminder: "reminder_focus",
  countdown: "countdown_focus",
  guide: "step_guide",
  custom: "conservative_stack",
};

const QUESTION_BY_INTENT: Record<CardIntent, string> = {
  timeline: "什么时候需要做什么？",
  deadline: "最晚什么时候完成？",
  training: "什么时候上什么课？",
  submission: "我要交什么、什么时候截止？",
  case_showcase: "这个案例值得看什么？",
  announcement: "发生了什么？",
  registration: "怎么参加？",
  result: "谁进入了下一阶段？",
  award: "获奖信息是什么？",
  reminder: "现在最需要注意什么？",
  countdown: "还剩多久？",
  guide: "怎么操作？",
  custom: "这张卡要传达什么？",
};

function count(copy: string, words: string[]): number {
  // Count total occurrences (not mere presence) so emphasis is reflected.
  return words.reduce((acc, w) => {
    if (!w) return acc;
    let n = 0;
    let from = 0;
    for (;;) {
      const idx = copy.indexOf(w, from);
      if (idx < 0) break;
      n += 1;
      from = idx + w.length;
    }
    return acc + n;
  }, 0);
}

export function routeCardIntent(sot: SourceOfTruth, rawCopy: string): CardIntentResult {
  const copy = rawCopy;
  const signals: IntentSignal[] = [];

  const add = (intent: CardIntent, score: number) => {
    if (score > 0) signals.push({ intent, score });
  };

  // submission
  add(
    "submission",
    count(copy, ["提交", "作品", "上交", "上传", "递交"]) * 2 +
      (sot.actions.some((a) => a.action === "提交作品") ? 2 : 0),
  );
  // deadline
  add(
    "deadline",
    count(copy, ["截止", "deadline", "最后", "结束", "停止提交"]) * 2 +
      (sot.deadlines.length > 0 ? 2 : 0),
  );
  // training — strong when multiple training signals / multiple sessions
  add(
    "training",
    count(copy, ["培训", "课程", "直播", "大班课", "专场", "训练营", "公开课", "系列课"]) * 2,
  );
  // timeline — multiple distinct dates + sequence words
  add(
    "timeline",
    (sot.dates.length >= 2 ? sot.dates.length : 0) +
      count(copy, ["赛程", "时间线", "阶段", "节点", "流程", "安排"]) * 2,
  );
  // case_showcase
  add("case_showcase", count(copy, ["案例", "场景", "实战", "拆解", "参考"]) * 2);
  // registration
  add("registration", count(copy, ["报名", "注册", "加入", "参加"]) * 2);
  // result
  add(
    "result",
    count(copy, ["名单", "晋级", "入围", "进入决赛", "结果公布"]) * 2 +
      count(copy, ["评审结果", "初赛结果", "复赛结果", "结果", "评审", "公布"]),
  );
  // award
  add("award", count(copy, ["获奖", "冠军", "亚军", "季军", "奖项", "领奖"]) * 2);
  // countdown
  add("countdown", count(copy, ["倒计时", "还剩", "仅剩", "最后一天", "24小时"]) * 2);
  // reminder
  add("reminder", count(copy, ["提醒", "别忘", "记得", "注意"]));
  // guide
  add("guide", count(copy, ["指南", "教程", "操作", "步骤", "怎么", "如何"]) * 2);
  // announcement baseline
  add("announcement", count(copy, ["通知", "公告", "开启", "启动", "上线", "就位"]) + 1);

  signals.sort((a, b) => b.score - a.score);
  const top = signals[0] ?? { intent: "announcement" as CardIntent, score: 1 };
  const second = signals[1];

  // Confidence from the head-to-head margin between the top two intents, not a
  // share of the total — otherwise a clear winner is punished by many weak
  // competing signals.
  const secondScore = second?.score ?? 0;
  let confidence: number;
  if (top.score <= 0) {
    confidence = 0.3;
  } else if (secondScore === 0) {
    confidence = 0.9;
  } else {
    const margin = (top.score - secondScore) / top.score; // 0..1
    confidence = 0.6 + margin * 0.38;
  }
  confidence = Math.max(0.3, Math.min(0.98, confidence));

  let intent = top.intent;
  if (confidence < 0.65) {
    intent = "announcement";
    confidence = 0.6;
  }

  const primaryAnchor = derivePrimaryAnchor(intent, sot);
  const secondaryAnchors = deriveSecondaryAnchors(intent, sot).slice(0, 3);

  return {
    primary_intent: intent,
    primary_question: QUESTION_BY_INTENT[intent],
    primary_action: derivePrimaryAction(intent, sot),
    primary_attention_anchor: primaryAnchor,
    secondary_attention_anchor: secondaryAnchors,
    recommended_layout: LAYOUT_BY_INTENT[intent],
    recommended_interactions: deriveInteractions(intent),
    confidence: Number(confidence.toFixed(2)),
  };
}

function derivePrimaryAnchor(intent: CardIntent, sot: SourceOfTruth): string {
  switch (intent) {
    case "deadline":
    case "submission":
      return sot.deadlines[0]?.value ?? sot.dates[0]?.value ?? "关键截止";
    case "timeline":
      return sot.dates[0] ? `${sot.dates[0].value} · ${sot.actions[0]?.action ?? "赛程节点"}` : "赛程时间线";
    case "training":
      return sot.times[0] ? `培训 · ${sot.times[0].value}` : "本周课程";
    case "result":
    case "award":
      return sot.rewards[0]?.value ?? "结果公布";
    case "countdown":
      return sot.deadlines[0]?.value ?? "倒计时";
    default:
      return sot.activity_name ?? "活动通知";
  }
}

function deriveSecondaryAnchors(intent: CardIntent, sot: SourceOfTruth): string[] {
  const anchors: string[] = [];
  if (intent === "submission" || intent === "deadline") {
    if (sot.actions[0]) anchors.push(sot.actions[0].action);
    if (sot.submission_requirements[0]) anchors.push(sot.submission_requirements[0].value);
  }
  if (intent === "training") {
    for (const t of sot.times.slice(0, 2)) anchors.push(t.value);
  }
  if (sot.deadlines[0] && intent !== "deadline") anchors.push(sot.deadlines[0].value);
  return anchors;
}

function derivePrimaryAction(intent: CardIntent, sot: SourceOfTruth): string {
  const action = sot.actions[0]?.action;
  if (action) return action;
  switch (intent) {
    case "submission":
      return "提交作品";
    case "training":
      return "预约直播";
    case "registration":
      return "立即报名";
    case "case_showcase":
      return "查看案例";
    case "timeline":
      return "按节点完成任务";
    default:
      return "查看详情";
  }
}

function deriveInteractions(intent: CardIntent): string[] {
  switch (intent) {
    case "submission":
      return ["提交作品", "查看规则"];
    case "training":
      return ["预约直播", "查看课程日历"];
    case "case_showcase":
      return ["查看案例"];
    case "registration":
      return ["立即报名"];
    default:
      return ["查看详情"];
  }
}
