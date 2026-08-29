import type { LinkTarget } from "../core/types.js";

/**
 * Deep Link Resolver (SPEC §40, PRD FR-36).
 *
 * Produces a LinkTarget with per-client URLs ONLY when the caller supplies
 * client-specific links. The universal URL must be mobile-usable first. If a
 * differentiated schema field is later found unsupported at runtime, callers
 * should fall back to `universal`.
 */
export interface DeepLinkInput {
  universal: string;
  pc?: string;
  ios?: string;
  android?: string;
}

export function resolveDeepLink(input: DeepLinkInput): {
  target: LinkTarget;
  mobileUsable: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  const target: LinkTarget = { universal: input.universal };
  if (input.pc) target.pc = input.pc;
  if (input.ios) target.ios = input.ios;
  if (input.android) target.android = input.android;

  // Heuristic mobile-usability check: reject clearly desktop-only patterns.
  const desktopOnly = /\/(admin|console|dashboard)\b/i.test(input.universal) && !input.ios && !input.android;
  const mobileUsable = !desktopOnly;
  if (desktopOnly) {
    notes.push(
      "universal URL 疑似仅桌面端友好（含 admin/console/dashboard），Primary CTA 需提供移动端可用链接或经手机验证。",
    );
  }
  if (!/^https?:\/\//.test(input.universal)) {
    notes.push("universal URL 非 http(s)，请确认为飞书内部可跳转链接。");
  }
  return { target, mobileUsable, notes };
}
