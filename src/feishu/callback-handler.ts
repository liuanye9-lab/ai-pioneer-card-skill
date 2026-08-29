import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Card Callback Handler (PRD §9.21, SPEC §18).
 *
 * Framework-agnostic core: takes the raw headers + body of a Feishu card
 * action callback and returns a structured response. Covers signature
 * verification, idempotency (duplicate click), expired action, invalid
 * payload, permission/API/network/timeout categories.
 *
 * A tiny HTTP server binding lives in scripts/callback-server.ts.
 */

export interface CallbackRequest {
  headers: Record<string, string | undefined>;
  rawBody: string;
}

export type CallbackErrorCode =
  | "SIGNATURE_INVALID"
  | "INVALID_PAYLOAD"
  | "DUPLICATE_CLICK"
  | "EXPIRED_ACTION"
  | "PERMISSION_ERROR"
  | "API_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT";

export interface CallbackResult {
  ok: boolean;
  code?: CallbackErrorCode;
  /** Response body to return to Feishu (e.g. a toast or updated card). */
  response?: any;
  message: string;
}

export interface CallbackHandlerOptions {
  verificationToken?: string;
  encryptKey?: string;
  /** Max age (ms) before an action is considered expired. */
  maxActionAgeMs?: number;
  /** Business dispatch: return a toast/card update for a given action key. */
  dispatch?: (payload: CardActionPayload) => Promise<any> | any;
}

export interface CardActionPayload {
  type?: string; // "url_verification" | "card.action.trigger" | ...
  challenge?: string;
  token?: string;
  action?: { value?: Record<string, any>; tag?: string };
  open_id?: string;
  user_id?: string;
  timestamp?: string;
  event_id?: string;
  [k: string]: any;
}

export class CardCallbackHandler {
  private seenEventIds = new Set<string>();
  private opts: CallbackHandlerOptions;

  constructor(opts: CallbackHandlerOptions = {}) {
    this.opts = { maxActionAgeMs: 5 * 60_000, ...opts };
  }

  /** Verify Feishu request signature (X-Lark-Signature) when encryptKey set. */
  verifySignature(req: CallbackRequest): boolean {
    if (!this.opts.encryptKey) return true; // signature not enforced
    const timestamp = req.headers["x-lark-request-timestamp"];
    const nonce = req.headers["x-lark-request-nonce"];
    const signature = req.headers["x-lark-signature"];
    if (!timestamp || !nonce || !signature) return false;
    const content = timestamp + nonce + this.opts.encryptKey + req.rawBody;
    const digest = createHash("sha256").update(content, "utf8").digest("hex");
    // Constant-time compare to avoid a timing side-channel on the signature.
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async handle(req: CallbackRequest): Promise<CallbackResult> {
    // 1. Signature
    if (!this.verifySignature(req)) {
      return { ok: false, code: "SIGNATURE_INVALID", message: "signature verification failed" };
    }

    // 2. Parse
    let payload: CardActionPayload;
    try {
      payload = JSON.parse(req.rawBody);
    } catch {
      return { ok: false, code: "INVALID_PAYLOAD", message: "body is not valid JSON" };
    }

    // 3. URL verification handshake
    if (payload.type === "url_verification" && payload.challenge) {
      return { ok: true, response: { challenge: payload.challenge }, message: "url_verification" };
    }

    // 4. Verification token (when configured)
    if (this.opts.verificationToken && payload.token && payload.token !== this.opts.verificationToken) {
      return { ok: false, code: "PERMISSION_ERROR", message: "verification token mismatch" };
    }

    // 5. Idempotency (duplicate click / redelivery). We only remember an
    //    event AFTER a successful dispatch, so a failed handler can be retried
    //    by Feishu's redelivery instead of being swallowed as a duplicate (D#3).
    if (payload.event_id && this.seenEventIds.has(payload.event_id)) {
      return { ok: true, code: "DUPLICATE_CLICK", message: "duplicate event ignored", response: { toast: { type: "info", content: "操作已处理" } } };
    }

    // 6. Expiry
    if (payload.timestamp) {
      const ts = Number(payload.timestamp) * (payload.timestamp.length <= 10 ? 1000 : 1);
      if (!Number.isNaN(ts) && Date.now() - ts > (this.opts.maxActionAgeMs ?? 300000)) {
        return { ok: false, code: "EXPIRED_ACTION", message: "action expired", response: { toast: { type: "error", content: "该操作已过期" } } };
      }
    }

    // 7. Dispatch business logic
    try {
      const response = this.opts.dispatch ? await this.opts.dispatch(payload) : { toast: { type: "success", content: "已收到" } };
      // Mark handled only on success (allows retry of failed dispatch).
      if (payload.event_id) this.rememberEvent(payload.event_id);
      return { ok: true, response, message: "handled" };
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (/permission|scope|forbidden/i.test(msg)) return { ok: false, code: "PERMISSION_ERROR", message: msg };
      if (/timeout/i.test(msg)) return { ok: false, code: "TIMEOUT", message: msg };
      if (/network|fetch|econn/i.test(msg)) return { ok: false, code: "NETWORK_ERROR", message: msg };
      return { ok: false, code: "API_ERROR", message: msg || "dispatch error" };
    }
  }

  /** Bounded idempotency memory (simple FIFO cap to avoid unbounded growth). */
  private rememberEvent(eventId: string): void {
    this.seenEventIds.add(eventId);
    if (this.seenEventIds.size > 5000) {
      const first = this.seenEventIds.values().next().value;
      if (first !== undefined) this.seenEventIds.delete(first);
    }
  }

  /** Test helper: clear idempotency memory. */
  reset(): void {
    this.seenEventIds.clear();
  }
}
