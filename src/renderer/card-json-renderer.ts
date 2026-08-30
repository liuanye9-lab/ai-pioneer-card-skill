import type {
  CTA,
  CardStructure,
  ContentBlock,
  MobileLayoutPlan,
  RenderModeResult,
  StyleProfile,
  ImagePlan,
} from "../core/types.js";

/**
 * Card JSON 2.0 Renderer.
 *
 * Field names verified against the official Feishu docs (2026-08):
 *  - top level: { schema: "2.0", config, header, body }
 *  - header: { title{tag,content}, subtitle, template, text_tag_list }
 *  - body:   { direction, padding, elements: [...] }
 *  - button: { tag:"button", text{tag,content}, type, width, size, behaviors:[{type:"open_url",url}|{type:"callback",value}] }
 *  - markdown: { tag:"markdown", content, text_align }
 *  - div:    { tag:"div", text{tag:"plain_text"|"lark_md",content} }
 *  - img:    { tag:"img", img_key, alt{tag,content}, scale_type }
 *  - column_set/column for limited two-column mobile layouts.
 *
 * NOTE: Real image publishing needs an img_key from the Feishu image-upload
 * API. Until an asset is uploaded we emit a placeholder-free note element and
 * keep the ImagePlan in the bundle, honoring the native-text-first rule.
 */

export interface RenderInput {
  structure: CardStructure;
  ctas: CTA[];
  style: StyleProfile;
  renderMode: RenderModeResult;
  mobileLayout: MobileLayoutPlan;
  imagePlan?: ImagePlan;
  imgKey?: string; // provided only after a real upload
  headerIconKey?: string; // uploaded logo img_key → header icon
}

const HEADER_ICON_TEMPLATE = "blue";

function textEl(content: string, tag: "plain_text" | "lark_md" = "lark_md") {
  return { tag, content };
}

function markdownEl(content: string, align: "left" | "center" | "right" = "left") {
  return { tag: "markdown", content, text_align: align };
}

function hrEl() {
  return { tag: "hr" };
}

function buttonEl(cta: CTA) {
  const behaviors: any[] = [];
  if (cta.type === "url" && cta.url) {
    // Card JSON 2.0 open_url uses default_url (+ optional per-client *_url).
    // No bare `url` field — that is a 1.0 leftover and is non-standard in 2.0.
    const b: any = { type: "open_url", default_url: cta.url };
    if (cta.linkTarget?.pc) b.pc_url = cta.linkTarget.pc;
    if (cta.linkTarget?.ios) b.ios_url = cta.linkTarget.ios;
    if (cta.linkTarget?.android) b.android_url = cta.linkTarget.android;
    behaviors.push(b);
  } else if (cta.type === "callback") {
    behaviors.push({ type: "callback", value: { key: cta.callbackKey ?? cta.id } });
  }

  return {
    tag: "button",
    text: textEl(cta.label, "plain_text"),
    type: cta.priority === "primary" ? "primary" : "default",
    width: cta.priority === "primary" ? "fill" : "default",
    size: "medium",
    behaviors,
    element_id: cta.id,
  };
}

function renderContentBlock(block: ContentBlock): any[] {
  const els: any[] = [];
  const c = block.content ?? {};

  switch (block.type) {
    case "text": {
      if (c.role === "primary_anchor") {
        const emoji = c.emoji ? `${c.emoji} ` : "";
        // Amplify the first-visual: deadlines/dates get color highlight + bold
        // (attention mechanism: 重点信息加粗放大高亮 > 美观), not just bold.
        const title = c.title ?? "";
        const highlighted = /截止|deadline|结束/i.test(title)
          ? `<font color="red">**${title}**</font>`
          : `**${title}**`;
        els.push(markdownEl(`${emoji}${highlighted}`));
        if (c.subtitle) els.push(markdownEl(c.subtitle));
      } else {
        const emoji = c.emoji ? `${c.emoji} ` : "";
        els.push(markdownEl(`${emoji}${c.text ?? ""}`));
      }
      break;
    }
    case "note": {
      const emoji = c.emoji ? `${c.emoji} ` : "";
      const content = c.muted ? `<font color="grey">${c.text ?? ""}</font>` : `${emoji}${c.text ?? ""}`;
      els.push(markdownEl(content));
      break;
    }
    case "timeline": {
      const nodes: Array<{ date: string; task: string; status: string }> = c.nodes ?? [];
      const lines = nodes.map((n) => {
        const marker = n.status === "current" ? "●" : n.status === "done" ? "✓" : "○";
        // Deadline node gets bold + red highlight so "什么时候截止" pops.
        const isDeadline = /截止|deadline|结束/i.test(n.task);
        if (isDeadline) return `${marker} <font color="red">**${n.date}**</font> · ${n.task}`;
        const weight = n.status === "current" ? "**" : "";
        return `${marker} ${weight}${n.date}${weight} · ${n.task}`;
      });
      els.push(markdownEl(lines.join("\n")));
      break;
    }
    case "badge": {
      els.push(markdownEl(`\`${c.text ?? ""}\``));
      break;
    }
    default:
      if (c.text) els.push(markdownEl(c.text));
  }
  return els;
}

/** Render secondary CTAs honoring the mobile row strategy. */
function renderSecondaryCTAs(ctas: CTA[], mobile: MobileLayoutPlan): any[] {
  const secondary = ctas.filter((c) => c.priority === "secondary");
  if (secondary.length === 0) return [];

  if (mobile.secondaryCTAStyle === "two_column" && mobile.maxSecondaryCTAPerRow === 2) {
    const rows: any[] = [];
    for (let i = 0; i < secondary.length; i += 2) {
      const pair = secondary.slice(i, i + 2);
      rows.push({
        tag: "column_set",
        flex_mode: "bisect",
        horizontal_spacing: "default",
        columns: pair.map((cta) => ({
          tag: "column",
          width: "weighted",
          weight: 1,
          elements: [buttonEl(cta)],
        })),
      });
    }
    return rows;
  }

  // stacked
  return secondary.map((cta) => buttonEl(cta));
}

export function renderCardJson(input: RenderInput): any {
  const { structure, ctas, style, mobileLayout, imagePlan, imgKey, headerIconKey } = input;
  const elements: any[] = [];

  // Primary anchor
  elements.push(...renderContentBlock(structure.primaryAnchor));

  // Information/hero image (only if we have a real img_key; else native text).
  if (imagePlan && imgKey) {
    elements.push({
      tag: "img",
      img_key: imgKey,
      alt: textEl(imagePlan.hero_title, "plain_text"),
      scale_type: "fit_horizontal",
    });
  } else if (imagePlan) {
    // Native-text fallback: represent the image's modules as scannable text so
    // the card is complete and mobile-readable without a baked-in image.
    const moduleLines = imagePlan.modules
      .map((m) => `• ${m.title}${m.key_points.length ? ` — ${m.key_points.join(" / ")}` : ""}`)
      .join("\n");
    if (moduleLines) {
      elements.push(markdownEl(`**${imagePlan.hero_title}**`));
      elements.push(markdownEl(moduleLines));
    }
  }

  // Critical-facts-in-native-text guarantee (DESIGN §6): whether or not an
  // image is present, precise facts baked/summarized in the image must ALSO
  // appear as native card text. Only add ones not already in the body/anchor.
  // Placeholder marker; the actual block is appended after body below.

  // Body blocks (sorted by priority ascending so P1 shows first).
  const body = [...structure.body].sort((a, b) => a.priority - b.priority);
  for (const b of body) {
    elements.push(...renderContentBlock(b));
  }

  // Now enforce the critical-facts guarantee against everything rendered so far.
  if (imagePlan && imagePlan.critical_facts_repeated_in_card.length) {
    const already = collectElementText(elements);
    const missing = imagePlan.critical_facts_repeated_in_card
      .filter((f) => !already.includes(f.replace(/截止$/, "")) && !already.includes(f))
      .filter((f, i, a) => a.indexOf(f) === i);
    if (missing.length) {
      elements.push(markdownEl(missing.map((f) => `📌 ${f}`).join("　")));
    }
  }

  // Primary CTA (full width, own row).
  const primary = ctas.find((c) => c.priority === "primary");
  if (primary) {
    elements.push(hrEl());
    elements.push(buttonEl(primary));
  }

  // Secondary CTAs.
  const secondaryEls = renderSecondaryCTAs(ctas, mobileLayout);
  if (secondaryEls.length) {
    if (!primary) elements.push(hrEl());
    elements.push(...secondaryEls);
  }

  // Footer notes.
  for (const f of structure.footer ?? []) {
    elements.push(...renderContentBlock(f));
  }

  const header: any = {
    title: textEl(structure.header.activityName, "plain_text"),
    subtitle: structure.header.subtitle ? textEl(structure.header.subtitle, "plain_text") : undefined,
    template: style.feishuHeaderTemplate || HEADER_ICON_TEMPLATE,
    text_tag_list: structure.header.badge
      ? [
          {
            tag: "text_tag",
            text: textEl(structure.header.badge, "plain_text"),
            color: style.feishuTagColor || "carmine",
          },
        ]
      : undefined,
  };
  // Header logo: a real uploaded logo (img_key) renders as a header icon; a
  // brand slug alone can't (Card 2.0 icon needs an img_key), so it's omitted
  // rather than faked. The premium gradient "wallpaper" look is achieved via a
  // generated hero img in the body, since headers only support preset colors.
  if (headerIconKey) {
    header.icon = { tag: "custom_icon", img_key: headerIconKey };
  }

  return {
    schema: "2.0",
    config: {
      update_multi: true,
      width_mode: "fill",
      enable_forward: true,
    },
    header: pruneUndefined(header),
    body: {
      direction: "vertical",
      padding: "12px 12px 12px 12px",
      elements,
    },
  };
}

function pruneUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Collect all rendered text from a partial elements array (for dedup checks). */
function collectElementText(elements: any[]): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (typeof n.content === "string") parts.push(n.content);
    if (n.text && typeof n.text.content === "string") parts.push(n.text.content);
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "object") walk(v);
    }
  };
  elements.forEach(walk);
  return parts.join("\n");
}
