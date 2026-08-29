import type { DeviceProfile } from "./types.js";

/**
 * Default mobile-first device profile (SPEC §32). Mobile is the baseline,
 * not a compatibility target.
 */
export const DEFAULT_DEVICE_PROFILE: DeviceProfile = {
  primarySurface: "mobile",
  targets: ["ios", "android", "desktop"],
  mobileFirst: true,
  allowHorizontalScroll: false,
  preferredColumns: 1,
  maxTextColumns: 2,
  preferredPrimaryCTA: "full_width",
};

/** Internal design threshold: "short" secondary CTA label (SPEC §36). */
export const SHORT_LABEL_MAX_CHARS = 8;

/** Mobile image readability heuristics (SPEC §39). */
export const IMAGE_MAX_MODULES = 4;
export const IMAGE_MAX_TEXT_LINES = 12;

/** QA gate (PRD §14 / §29). */
export const QA_PASS_THRESHOLD = 85;
export const MAX_AUTO_REWRITES = 2;

/** Semantic emoji anchors (PRD §9.4). */
export const EMOJI_ANCHORS: Record<string, string> = {
  date: "📅",
  deadline: "⏰",
  location: "📍",
  task: "🎯",
  submission: "📤",
  reward: "🏆",
  training: "🎓",
  tip: "💡",
  people: "👥",
  link: "🔗",
  announcement: "📣",
  countdown: "⏳",
};
