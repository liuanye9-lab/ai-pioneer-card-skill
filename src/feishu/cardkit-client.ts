import { loadCredentials, getTenantAccessToken, type FeishuAuthState } from "./auth.js";
import { validateCardJson, type CardValidationResult } from "../renderer/card-validator.js";

/**
 * Feishu Card Adapter (SPEC §16). Implements createCard / sendCard /
 * updateCard / validateCard.
 *
 * Status model (PRD §9.20, SKILL §28):
 *  - Generated : JSON produced (always available, offline).
 *  - Configured: credentials present, but no real send/interaction yet.
 *  - Tested    : a real send/update/callback succeeded.
 *
 * validateCard() always works offline. The networked methods require real
 * credentials; without them they return a structured "not configured" result
 * rather than throwing, so generation is never blocked.
 */

export interface CreateCardResult {
  ok: boolean;
  status: "Generated" | "Configured" | "Tested";
  cardId?: string;
  message: string;
}

export interface SendTarget {
  receiveIdType: "chat_id" | "open_id" | "user_id" | "email";
  receiveId: string;
}

export interface SendResult {
  ok: boolean;
  status: "Configured" | "Tested";
  messageId?: string;
  message: string;
}

export interface UpdateResult {
  ok: boolean;
  status: "Configured" | "Tested";
  message: string;
}

export interface UploadImageResult {
  ok: boolean;
  status: "Generated" | "Configured" | "Tested";
  imageKey?: string;
  message: string;
}

export class FeishuCardAdapter {
  private auth: FeishuAuthState;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.auth = loadCredentials(env);
  }

  get configured(): boolean {
    return this.auth.configured;
  }

  get statusReason(): string | undefined {
    return this.auth.reason;
  }

  /** Always-offline structural validation. */
  async validateCard(cardJson: unknown): Promise<CardValidationResult> {
    return validateCardJson(cardJson);
  }

  /**
   * Create a CardKit card entity. Requires credentials. Uses the documented
   * CardKit create endpoint shape ({ type:"card_json", data }).
   */
  async createCard(cardJson: unknown): Promise<CreateCardResult> {
    const validation = validateCardJson(cardJson);
    if (!validation.valid) {
      return { ok: false, status: "Generated", message: `INVALID_CARD_SCHEMA: ${validation.errors.join("; ")}` };
    }
    if (!this.auth.configured || !this.auth.credentials) {
      return {
        ok: false,
        status: "Generated",
        message: this.auth.reason ?? "credentials not configured",
      };
    }

    try {
      const token = await getTenantAccessToken(this.auth.credentials);
      const res = await fetch(`${this.auth.credentials.baseUrl}/open-apis/cardkit/v1/cards`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ type: "card_json", data: JSON.stringify(cardJson) }),
      });
      const data = (await res.json()) as any;
      if (data.code !== 0) {
        return { ok: false, status: "Configured", message: `create failed: ${data.msg} (code ${data.code})` };
      }
      return {
        ok: true,
        status: "Tested",
        cardId: data.data?.card_id,
        message: "card entity created",
      };
    } catch (e) {
      return { ok: false, status: "Configured", message: `network/API error: ${(e as Error).message}` };
    }
  }

  /** Send an interactive card message to a chat/user. */
  async sendCard(target: SendTarget, cardJson: unknown): Promise<SendResult> {
    if (!this.auth.configured || !this.auth.credentials) {
      return { ok: false, status: "Configured", message: this.auth.reason ?? "credentials not configured" };
    }
    try {
      const token = await getTenantAccessToken(this.auth.credentials);
      const res = await fetch(
        `${this.auth.credentials.baseUrl}/open-apis/im/v1/messages?receive_id_type=${target.receiveIdType}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({
            receive_id: target.receiveId,
            msg_type: "interactive",
            content: JSON.stringify({ type: "card_json", data: cardJson }),
          }),
        },
      );
      const data = (await res.json()) as any;
      if (data.code !== 0) {
        return { ok: false, status: "Configured", message: `send failed: ${data.msg} (code ${data.code})` };
      }
      return { ok: true, status: "Tested", messageId: data.data?.message_id, message: "card sent" };
    } catch (e) {
      return { ok: false, status: "Configured", message: `network/API error: ${(e as Error).message}` };
    }
  }

  /** Update an existing card entity (dynamic status cards, FR-22). */
  async updateCard(cardId: string, cardJson: unknown): Promise<UpdateResult> {
    if (!this.auth.configured || !this.auth.credentials) {
      return { ok: false, status: "Configured", message: this.auth.reason ?? "credentials not configured" };
    }
    try {
      const token = await getTenantAccessToken(this.auth.credentials);
      const res = await fetch(`${this.auth.credentials.baseUrl}/open-apis/cardkit/v1/cards/${cardId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ card: { type: "card_json", data: JSON.stringify(cardJson) } }),
      });
      const data = (await res.json()) as any;
      if (data.code !== 0) {
        return { ok: false, status: "Configured", message: `update failed: ${data.msg} (code ${data.code})` };
      }
      return { ok: true, status: "Tested", message: "card updated" };
    } catch (e) {
      return { ok: false, status: "Configured", message: `network/API error: ${(e as Error).message}` };
    }
  }

  /**
   * Upload a local image and return its img_key so the card can render a real
   * img element (the image landing path). Without credentials this returns a
   * structured "not configured" result — callers keep the native-text fallback.
   */
  async uploadImage(filePath: string): Promise<UploadImageResult> {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch {
      return { ok: false, status: "Generated", message: `image file not readable: ${filePath}` };
    }
    return this.uploadImageBytes(new Uint8Array(bytes), basename(filePath));
  }

  /**
   * Upload in-memory image bytes (e.g. from the image generator) → img_key.
   * Same im/v1/images endpoint; keeps the credential/degradation contract.
   */
  async uploadImageBytes(bytes: Uint8Array, name = "generated.png"): Promise<UploadImageResult> {
    if (!this.auth.configured || !this.auth.credentials) {
      return { ok: false, status: "Generated", message: this.auth.reason ?? "credentials not configured" };
    }
    try {
      const token = await getTenantAccessToken(this.auth.credentials);
      const form = new FormData();
      form.append("image_type", "message");
      form.append("image", new Blob([bytes], { type: "application/octet-stream" }), name);
      const res = await fetch(`${this.auth.credentials.baseUrl}/open-apis/im/v1/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = (await res.json()) as any;
      if (data.code !== 0 || !data.data?.image_key) {
        return { ok: false, status: "Configured", message: `upload failed: ${data.msg} (code ${data.code})` };
      }
      return { ok: true, status: "Tested", imageKey: data.data.image_key, message: "image uploaded" };
    } catch (e) {
      return { ok: false, status: "Configured", message: `network/API error: ${(e as Error).message}` };
    }
  }

  /**
   * Fetch a remote image URL (from the generator) and upload it → img_key.
   */
  async uploadImageFromUrl(imageUrl: string): Promise<UploadImageResult> {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return { ok: false, status: "Generated", message: `image url HTTP ${res.status}` };
      const bytes = new Uint8Array(await res.arrayBuffer());
      return this.uploadImageBytes(bytes, "generated.png");
    } catch (e) {
      return { ok: false, status: "Generated", message: `image url fetch error: ${(e as Error).message}` };
    }
  }
}
