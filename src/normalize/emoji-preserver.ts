/**
 * Emoji preservation (PRD §9.4, SPEC §7, SKILL §7).
 *
 * Hard rule: original emoji characters MUST stay as characters. Never turn
 * `📣` into `【喇叭】`. The reverse — a clearly-labelled `[喇叭]` bracket text —
 * MAY be upgraded to its emoji only when semantically unambiguous.
 */

/** Bracketed text that some tools emit instead of real emoji. */
const TEXT_TO_EMOJI: Record<string, string> = {
  喇叭: "📣",
  日历: "📅",
  闹钟: "⏰",
  地点: "📍",
  定位: "📍",
  奖杯: "🏆",
  礼物: "🎁",
  礼花: "🎉",
  庆祝: "🎉",
  鼓掌: "👏",
  灯泡: "💡",
  链接: "🔗",
  火: "🔥",
  星星: "⭐",
  勾: "✅",
  对勾: "✅",
  完成: "✅",
  玫瑰: "🌹",
  太阳: "☀️",
  月亮: "🌙",
  爱心: "❤️",
  红心: "❤️",
  点赞: "👍",
  赞: "👍",
  铃铛: "🔔",
  通知: "🔔",
  火箭: "🚀",
  钱袋: "💰",
  奖牌: "🏅",
  证书: "🎖️",
  笔: "✏️",
  书: "📖",
  电话: "📞",
  邮件: "📧",
  警告: "⚠️",
  禁止: "🚫",
  问号: "❓",
  感叹号: "❗",
  眼睛: "👀",
  手: "✋",
  ok: "🆗",
  OK: "🆗",
  笑脸: "😄",
  哭: "😭",
  思考: "🤔",
};

// Broad emoji ranges (covers the pictographs used in activity copy).
/* eslint-disable no-misleading-character-class -- intentional emoji ranges under /u */
const EMOJI_REGEX =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{20E3}]/gu;
/* eslint-enable no-misleading-character-class */

export function extractEmojis(text: string): string[] {
  return text.match(EMOJI_REGEX) ?? [];
}

export function containsEmoji(text: string): boolean {
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(text);
}

/**
 * Detect the forbidden transformation: an emoji that was replaced by a
 * bracketed Chinese label. Returns the offending labels found in `output`
 * whose emoji existed in `input`.
 */
export function detectEmojiTextualization(input: string, output: string): string[] {
  const offenders: string[] = [];
  const inputEmojis = new Set(extractEmojis(input));
  for (const [label, emoji] of Object.entries(TEXT_TO_EMOJI)) {
    const bracketVariants = [`【${label}】`, `[${label}]`];
    for (const variant of bracketVariants) {
      if (output.includes(variant) && inputEmojis.has(emoji) && !output.includes(emoji)) {
        offenders.push(variant);
      }
    }
  }
  return offenders;
}

/**
 * Upgrade clearly-bracketed labels to emoji when the emoji was NOT already
 * present as a character. Conservative: only exact bracket forms.
 */
export function upgradeBracketLabels(text: string): string {
  let out = text;
  for (const [label, emoji] of Object.entries(TEXT_TO_EMOJI)) {
    out = out.replace(new RegExp(`【${label}】`, "g"), emoji);
    out = out.replace(new RegExp(`\\[${label}\\]`, "g"), emoji);
  }
  return out;
}

/**
 * Assert emoji fidelity between the source copy and any generated text.
 * Every emoji present in the source must survive verbatim if it is meant to
 * be carried over. We only check that no source emoji was textualized.
 */
export function assertEmojiFidelity(source: string, generated: string): {
  ok: boolean;
  offenders: string[];
} {
  const offenders = detectEmojiTextualization(source, generated);
  return { ok: offenders.length === 0, offenders };
}
