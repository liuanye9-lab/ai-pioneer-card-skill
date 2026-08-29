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
}
