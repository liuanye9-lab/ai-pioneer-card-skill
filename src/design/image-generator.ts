import type { ImagePlan, StyleProfile } from "../core/types.js";

/**
 * Image Generator (pluggable, dual-mode).
 *
 * The card pipeline PLANS an image (style-constrained prompt + aspect ratio) but
 * historically never produced pixels, so "image-led" cards degraded to text.
 * This module turns a plan into a real image via one of two sources:
 *
 *   1. RUNTIME mode — if IMAGE_API_URL is set, the skill calls that text-to-image
 *      endpoint directly (GET with ?prompt=&image_size=, optional bearer key).
 *      Works for `npm`/CI/server deployments that own an image model.
 *   2. DELEGATE mode — if no endpoint is configured, we DON'T fake an image; we
 *      return a `delegate` result carrying the finished prompt + size so the host
 *      (e.g. the Doubao work-companion's own 图片生成 capability) can render it and
 *      feed the bytes/URL back. Zero-config still degrades gracefully to text.
 *
 * On success the produced image (URL or bytes) is handed to the Feishu image
 * upload (im/v1/images) to obtain an `img_key`, which is the only thing the
 * Card JSON 2.0 `img` element accepts.
 */

export type ImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export type ImageGenMode = "runtime" | "delegate" | "disabled";

export interface GeneratedImage {
  ok: boolean;
  mode: ImageGenMode;
  /** A fetchable image URL (runtime mode success). */
  url?: string;
  /** Raw image bytes (runtime mode success when the API returns binary). */
  bytes?: Uint8Array;
  /** The finished prompt + size, so a host/delegate can render it. */
  prompt: string;
  size: ImageSize;
  message: string;
}

/** Map a plan aspect ratio ("16:9", "3:4", "1:1"…) to a supported image_size. */
export function aspectToImageSize(aspect: string | undefined): ImageSize {
  switch ((aspect ?? "").trim()) {
    case "16:9":
      return "landscape_16_9";
    case "4:3":
      return "landscape_4_3";
    case "3:4":
      return "portrait_4_3";
    case "9:16":
      return "portrait_16_9";
    case "1:1":
      return "square_hd";
    default:
      // Hero banners default to a wide, premium landscape.
      return "landscape_16_9";
  }
}

/**
 * Build the final, style-constrained prompt. `plan.prompt` is already
 * assembled by the image-planner with palette + visual direction; here we just
 * guarantee the SDXL-style quality/negative hints and a no-baked-text rule
 * (Chinese text is unreliable in generation and must live in native card text).
 */
export function buildFinalPrompt(plan: ImagePlan, style: StyleProfile): string {
  const base = plan.prompt?.trim() || `${plan.hero_title ?? ""} ${style.visualDirection ?? ""}`.trim();
  const quality =
    "high-end, premium, refined, clean composition, soft depth, tasteful lighting, 4k, professional";
  const noText = "no text, no watermark, no logo lettering";
  return [base, quality, noText].filter(Boolean).join(", ");
}

function resolveMode(env: NodeJS.ProcessEnv): ImageGenMode {
  if (env.IMAGE_GEN_DISABLED === "1") return "disabled";
  if (env.IMAGE_API_URL || env.IMAGE_PROVIDER_BASE_URL) return "runtime";
  return "delegate";
}

/** Endpoint + key resolved from either the new or pre-existing env names. */
function resolveEndpoint(env: NodeJS.ProcessEnv): { url?: string; key?: string } {
  return {
    url: env.IMAGE_API_URL ?? env.IMAGE_PROVIDER_BASE_URL,
    key: env.IMAGE_API_KEY ?? env.IMAGE_PROVIDER_API_KEY,
  };
}

/**
 * Generate (or delegate) an image for a plan. Never throws — on any failure it
 * returns `ok:false` so the caller keeps the native-text fallback.
 */
export async function generateImage(
  plan: ImagePlan,
  style: StyleProfile,
  opts?: { size?: ImageSize; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<GeneratedImage> {
  const env = opts?.env ?? process.env;
  const size = opts?.size ?? aspectToImageSize(plan.aspect_ratio);
  const prompt = buildFinalPrompt(plan, style);
  const mode = resolveMode(env);

  if (mode === "disabled") {
    return { ok: false, mode, prompt, size, message: "image generation disabled (IMAGE_GEN_DISABLED=1)" };
  }

  if (mode === "delegate") {
    // No runtime endpoint: hand the finished spec to the host to render.
    return {
      ok: false,
      mode,
      prompt,
      size,
      message:
        "no image endpoint configured — delegating to the host image capability. " +
        "Set IMAGE_API_URL / IMAGE_PROVIDER_BASE_URL (+ optional key) to generate in-process.",
    };
  }

  // Runtime mode: call the configured text-to-image endpoint.
  const { url: endpoint, key } = resolveEndpoint(env);
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const url = `${endpoint}${endpoint!.includes("?") ? "&" : "?"}prompt=${encodeURIComponent(
    prompt,
  )}&image_size=${size}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      return { ok: false, mode, prompt, size, message: `image API HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      return { ok: true, mode, bytes: buf, prompt, size, message: "image generated (binary)" };
    }
    // JSON response: expect a URL somewhere common ({url}|{data.url}|{image_url}).
    const data: any = await res.json().catch(() => null);
    const imgUrl: string | undefined =
      data?.url ?? data?.image_url ?? data?.data?.url ?? data?.data?.image_url ?? data?.data?.[0]?.url;
    if (imgUrl) {
      return { ok: true, mode, url: imgUrl, prompt, size, message: "image generated (url)" };
    }
    return { ok: false, mode, prompt, size, message: `image API returned no url/binary` };
  } catch (e) {
    return { ok: false, mode, prompt, size, message: `image API error: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}
