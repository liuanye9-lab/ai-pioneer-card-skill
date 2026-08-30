import type {
  QACheck,
  QAIssue,
  CardStructure,
  CardIntentResult,
  CTA,
} from "../core/types.js";

/**
 * Information QA (PRD §13.2). 3-second / 5-second / first-visual / no wall-of-
 * text / clear CTA.
 */
export function runInformationQA(input: {
  structure: CardStructure;
  intent: CardIntentResult;
  ctas: CTA[];
  cardText: string;
}): QACheck {
  const { structure, intent, ctas, cardText } = input;
  const issues: QAIssue[] = [];

  // First visual must be the primary anchor.
  if (!structure.primaryAnchor) {
    issues.push({ code: "NO_PRIMARY_ANCHOR", severity: "error", message: "缺少第一视觉重点", stage: "information_qa" });
  }

  // Deadline/submission: first visual should carry the deadline/time.
  if (intent.primary_intent === "deadline" || intent.primary_intent === "submission") {
    const title = structure.primaryAnchor?.content?.title ?? "";
    if (!/截止|\d+月\d+日|\d{1,2}:\d{2}/.test(title)) {
      issues.push({
        code: "DEADLINE_NOT_FIRST",
        severity: "error",
        message: "Deadline/Submission 卡第一视觉未突出截止时间",
        stage: "information_qa",
      });
    }
  }

  // No wall of text. Extract renderable text from EVERY block shape (not just
  // b.content.text): anchor title+subtitle, note/text, and timeline nodes. A
  // single un-broken block that is very long is a hard_fail (drives the rewrite
  // loop); a moderately long one is an error (score deduction + remediation).
  const HARD_WALL = 90; // chars in one block with no line breaks → must split
  const SOFT_WALL = 50; // chars → should split
  for (const b of structure.body) {
    const c = b.content ?? {};
    const pieces: string[] = [];
    if (typeof c.text === "string") pieces.push(c.text);
    if (typeof c.title === "string") pieces.push(c.title);
    if (typeof c.subtitle === "string") pieces.push(c.subtitle);
    if (Array.isArray(c.nodes)) {
      for (const n of c.nodes) pieces.push(`${n?.date ?? ""}${n?.task ?? ""}`);
    }
    // Evaluate the longest single unbroken run (split on existing separators).
    const longestRun = pieces
      .flatMap((p) => p.split(/\n|。|；|;/))
      .map((s) => s.trim().length)
      .reduce((a, b2) => Math.max(a, b2), 0);
    if (longestRun > HARD_WALL) {
      issues.push({
        code: "TEXT_WALL",
        severity: "hard_fail",
        message: `存在文字墙（单段 ${longestRun} 字未拆分），必须拆分/折叠/转按钮`,
        stage: "information_qa",
      });
      break;
    }
    if (longestRun > SOFT_WALL) {
      issues.push({
        code: "TEXT_WALL",
        severity: "error",
        message: `单模块偏长（${longestRun} 字），建议拆分为多段或转按钮`,
        stage: "information_qa",
      });
      break;
    }
  }

  // No raw URL jammed into body text (links belong on buttons). This must never
  // ship, so it's a hard_fail — the body-assembler & IA strip URLs upstream.
  if (/https?:\/\//i.test(cardText)) {
    issues.push({
      code: "INLINE_URL_IN_BODY",
      severity: "hard_fail",
      message: "正文出现裸链接，应改为按钮承载",
      stage: "information_qa",
    });
  }

  // Clear CTA: at least an action is expressed (button OR body action text).
  const hasCta = ctas.length > 0;
  const hasActionText = /提交|报名|查看|预约|进入|参加/.test(cardText);
  if (!hasCta && !hasActionText) {
    issues.push({
      code: "NO_CLEAR_ACTION",
      severity: "warning",
      message: "未发现明确的下一步行动",
      stage: "information_qa",
    });
  }

  return { name: "information_qa", pass: !issues.some((i) => i.severity === "hard_fail"), issues };
}
