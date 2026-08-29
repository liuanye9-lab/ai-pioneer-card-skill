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

  // No wall of text: any single block > 4 lines is a violation.
  for (const b of structure.body) {
    const text: string = b.content?.text ?? "";
    const lineCount = text.split(/\n/).length + Math.ceil(text.length / 24);
    if (lineCount > 5) {
      issues.push({
        code: "TEXT_WALL",
        severity: "error",
        message: "存在文字墙（单模块过长），应拆分/折叠/转按钮",
        stage: "information_qa",
      });
      break;
    }
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
