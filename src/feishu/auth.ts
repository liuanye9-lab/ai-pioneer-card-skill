/**
 * Feishu credential + token management (SPEC §17).
 *
 * Reads credentials from the environment ONLY. Never logs secrets, never
 * writes them to any artifact. When credentials are absent the whole adapter
 * runs in "offline" mode so generation is never blocked.
 */

export interface FeishuCredentials {
  appId: string;
  appSecret: string;
  verificationToken?: string;
  encryptKey?: string;
  baseUrl: string;
}

export interface FeishuAuthState {
  configured: boolean;
  credentials?: FeishuCredentials;
  reason?: string;
}

export function loadCredentials(env: NodeJS.ProcessEnv = process.env): FeishuAuthState {
  const appId = env.FEISHU_APP_ID?.trim();
  const appSecret = env.FEISHU_APP_SECRET?.trim();
  const baseUrl = (env.FEISHU_BASE_URL?.trim() || "https://open.feishu.cn").replace(/\/$/, "");

  if (!appId || !appSecret) {
    return {
      configured: false,
      reason: "FEISHU_APP_ID / FEISHU_APP_SECRET 未配置，Feishu 适配器进入离线模式（状态 Generated）。",
    };
  }

  return {
    configured: true,
    credentials: {
      appId,
      appSecret,
      verificationToken: env.FEISHU_VERIFICATION_TOKEN?.trim(),
      encryptKey: env.FEISHU_ENCRYPT_KEY?.trim(),
      baseUrl,
    },
  };
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cache: CachedToken | null = null;

/**
 * Fetch a tenant_access_token. Uses the documented endpoint. Never logs the
 * secret or the returned token.
 */
export async function getTenantAccessToken(creds: FeishuCredentials): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 30_000) return cache.token;

  const res = await fetch(`${creds.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
  });

  if (!res.ok) {
    throw new Error(`FEISHU_AUTH_ERROR: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { code: number; msg: string; tenant_access_token?: string; expire?: number };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`FEISHU_AUTH_ERROR: ${data.msg} (code ${data.code})`);
  }
  cache = {
    token: data.tenant_access_token,
    expiresAt: now + (data.expire ?? 7200) * 1000,
  };
  return cache.token;
}

export function resetTokenCache(): void {
  cache = null;
}
