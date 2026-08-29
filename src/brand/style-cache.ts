import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { StyleProfile } from "../core/types.js";
import { DEFAULT_STYLE } from "./default-style.js";

/**
 * Style cache (SPEC §23). Resolves a brand slug to a cached style.md under
 * brands/{slug}/. Returns null when the brand is not cached so the resolver
 * can decide whether to research or fall back to the default style.
 */

export function slugify(brandName: string): string {
  const map: Record<string, string> = {
    象上汇: "xiangshanghui",
    象上汇先锋大赛: "xiangshanghui",
  };
  if (map[brandName]) return map[brandName];
  return brandName
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function loadCachedBrandStyle(brandsDir: string, brandName: string): StyleProfile | null {
  const slug = slugify(brandName);
  const stylePath = join(brandsDir, slug, "style.md");
  if (!existsSync(stylePath)) return null;

  const markdown = readFileSync(stylePath, "utf8");
  return parseStyleMarkdown(slug, markdown);
}

/** Extract a color hex from a "- Label (name): #RRGGBB" or "Label: #RRGGBB" line. */
function findHex(markdown: string, labels: string[], fallback: string): string {
  for (const label of labels) {
    const re = new RegExp(`${label}[^#\\n]*?(#[0-9A-Fa-f]{6})`);
    const m = markdown.match(re);
    if (m) return m[1];
  }
  return fallback;
}

export function parseStyleMarkdown(slug: string, markdown: string): StyleProfile {
  const c = DEFAULT_STYLE.colors;
  const colors = {
    primaryBrand: findHex(markdown, ["Primary Brand", "主色", "象黑"], c.primaryBrand),
    primaryText: findHex(markdown, ["Primary Text", "主标题"], c.primaryText),
    secondaryText: findHex(markdown, ["Secondary Text", "水墨灰", "说明"], c.secondaryText),
    mutedText: findHex(markdown, ["Muted", "岩灰"], c.mutedText),
    surface: findHex(markdown, ["Surface", "留白", "米白"], c.surface),
    elevatedSurface: findHex(markdown, ["Elevated Surface"], c.elevatedSurface),
    accent: findHex(markdown, ["Accent", "鎏金", "强调"], c.accent),
    success: findHex(markdown, ["Success", "晋级"], c.success),
    warning: findHex(markdown, ["Warning", "倒计时"], c.warning),
    danger: findHex(markdown, ["Danger"], c.danger),
    divider: findHex(markdown, ["Divider", "分割"], c.divider),
  };

  const identityMatch = markdown.match(/# Brand Identity\s*\n([^\n]+)/);
  const keywordsMatch = markdown.match(/# Keywords\s*\n([^\n]+)/);
  const directionMatch = markdown.match(/# Visual Direction\s*\n([^\n]+)/);
  const toneMatch = markdown.match(/# Emotional Tone\s*\n([^\n]+)/);

  return {
    slug,
    brandIdentity: identityMatch?.[1]?.trim() ?? slug,
    keywords: keywordsMatch?.[1]?.split(/[/,、]/).map((s) => s.trim()).filter(Boolean) ?? [],
    visualDirection: directionMatch?.[1]?.trim() ?? "",
    emotionalTone: toneMatch?.[1]?.trim() ?? "",
    colors,
    gradient: "brand-defined (see style.md)",
    feishuHeaderTemplate: pickHeaderTemplate(colors.primaryBrand),
    isBrandResolved: true,
    markdown,
  };
}

/** Map a brand primary color to the closest Feishu header template token. */
function pickHeaderTemplate(hex: string): string {
  const h = hex.toLowerCase();
  if (/^#(16|1f|20|00|11|22)/.test(h)) return "grey"; // dark/neutral brands (象黑)
  if (/^#(2b|3|4|5).*(f6|ff)/.test(h)) return "blue";
  return "wathet";
}
