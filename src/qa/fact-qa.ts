import type { QACheck, QAIssue, SourceOfTruth, CTA } from "../core/types.js";
import { verifyFactLock } from "../parser/fact-locker.js";
import { assertEmojiFidelity } from "../normalize/emoji-preserver.js";

/**
 * Fact QA (PRD §13.1, SPEC §20). The hardest gate. Any violation is a
 * hard_fail regardless of the aesthetic score.
 */
export function runFactQA(input: {
  sot: SourceOfTruth;
  rawCopy: string;
  cardText: string;
  ctas: CTA[];
}): QACheck {
  const { sot, rawCopy, cardText, ctas } = input;
  const issues: QAIssue[] = [];

  // 1. Locked-fact traceability + invented URL + name truncation.
  const lock = verifyFactLock(cardText, sot);
  for (const v of lock.violations) {
    issues.push({ code: v.code, severity: "hard_fail", message: v.message, stage: "fact_qa" });
  }

  // 2. Emoji fidelity — no 📣 -> 【喇叭】.
  const emoji = assertEmojiFidelity(rawCopy, cardText);
  if (!emoji.ok) {
    issues.push({
      code: "EMOJI_TEXTUALIZED",
      severity: "hard_fail",
      message: `Emoji 被文字化：${emoji.offenders.join(", ")}`,
      stage: "fact_qa",
    });
  }

  // 3. CTA URLs must exist in source (never invented).
  const sourceUrls = new Set(sot.links.map((l) => l.url));
  for (const cta of ctas) {
    if (cta.type === "url" && cta.url && !sourceUrls.has(cta.url)) {
      issues.push({
        code: "INVENTED_CTA_URL",
        severity: "hard_fail",
        message: `CTA "${cta.label}" 使用了来源中不存在的 URL: ${cta.url}`,
        stage: "fact_qa",
      });
    }
  }

  // 4. Deadline not dropped: if source has a deadline, it must appear.
  for (const d of sot.deadlines) {
    if (!cardText.includes(d.date)) {
      issues.push({
        code: "DEADLINE_DROPPED",
        severity: "hard_fail",
        message: `关键 Deadline 缺失：${d.date}`,
        stage: "fact_qa",
      });
    }
  }

  // 5. Dates must appear in canonical form (no raw 0809 / 8.9 leaking).
  const rawDateLeak = /(?<!\d)\d{4}(?!\d)|\d{1,2}[./]\d{1,2}/g;
  const leaked = cardText.match(rawDateLeak);
  if (leaked) {
    // Only flag if a leaked token is actually a date we normalized.
    for (const token of leaked) {
      const norm = sot.dates.find((dt) => dt.source_text === token && dt.value !== token);
      if (norm) {
        issues.push({
          code: "DATE_NOT_NORMALIZED",
          severity: "error",
          message: `日期未标准化：${token} 应为 ${norm.value}`,
          stage: "fact_qa",
        });
      }
    }
  }

  // 6. Other locked precise facts must survive (D1): times & rewards. These are
  //    concrete, short, image-unsafe values that must appear in native text.
  for (const t of sot.times) {
    if (!cardText.includes(t.value)) {
      issues.push({
        code: "TIME_DROPPED",
        severity: "error",
        message: `关键时间缺失：${t.value}`,
        stage: "fact_qa",
      });
    }
  }
  for (const r of sot.rewards) {
    // Rewards are sentences; require the numeric/award core token to survive.
    const core = r.value.match(/(\d[\d,.]*\s*(?:万|元|名|个)?|冠军|亚军|季军|一等奖|二等奖|三等奖)/)?.[0];
    if (core && !cardText.includes(core)) {
      issues.push({
        code: "REWARD_DROPPED",
        severity: "error",
        message: `奖项关键信息缺失：${core}`,
        stage: "fact_qa",
      });
    }
  }

  return { name: "fact_qa", pass: issues.every((i) => i.severity !== "hard_fail"), issues };
}
