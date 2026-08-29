import type { CTA, SourceOfTruth } from "../core/types.js";

/**
 * Scope Resolver (PRD §12.2, SPEC — Least Privilege).
 *
 * Derives the minimal Feishu permission scope checklist from what the card
 * ACTUALLY does. We never request scopes that the card does not need.
 */
export function resolveScopes(input: {
  ctas: CTA[];
  sot: SourceOfTruth;
  willSend: boolean;
  hasCallback: boolean;
}): string[] {
  const scopes = new Set<string>();

  if (input.willSend) {
    // Sending an interactive card message to a chat.
    scopes.add("im:message"); // 发送与管理消息
    scopes.add("im:message:send_as_bot"); // 以应用身份发消息
  }

  // Using the CardKit entity create/update flow.
  scopes.add("cardkit:card:write"); // 创建/更新卡片实体（如启用 CardKit）

  if (input.hasCallback || input.ctas.some((c) => c.type === "callback")) {
    // Card action callbacks are delivered via event subscription, which needs
    // the app to have the card callback capability enabled (not a token scope
    // per se, but we surface it as a checklist item).
    scopes.add("[event] card.action.trigger 回调订阅已开启");
  }

  // Links to bitable / docs are just URLs — no scope needed unless we read them.
  const usesBitable = input.sot.links.some((l) => /base|bitable/.test(l.url));
  if (usesBitable) {
    scopes.add("[optional] bitable:app (仅当需要读写多维表时)");
  }

  return [...scopes];
}
