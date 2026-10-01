import { createHash, randomBytes } from "crypto";
import type { ClaudeTokens } from "@/providers/types";

/** Public Claude Code OAuth client (PKCE, no client secret). */
export const CLAUDE_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
export const CLAUDE_AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
export const CLAUDE_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
/** Anthropic-registered redirect used by Claude Code manual flow. */
export const CLAUDE_REDIRECT_URI =
  "https://console.anthropic.com/oauth/code/callback";
export const CLAUDE_OAUTH_SCOPES =
  "org:create_api_key user:profile user:inference";
const CLAUDE_UA = "claude-code/2.1.72";

export type ClaudePkce = {
  verifier: string;
  challenge: string;
  state: string;
};

export function generateClaudePkce(): ClaudePkce {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { verifier, challenge, state };
}

export function buildClaudeAuthUrl(pkce: ClaudePkce): string {
  const url = new URL(CLAUDE_AUTHORIZE_URL);
  url.searchParams.set("code", "true");
  url.searchParams.set("client_id", CLAUDE_OAUTH_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", CLAUDE_REDIRECT_URI);
  url.searchParams.set("scope", CLAUDE_OAUTH_SCOPES);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", pkce.state);
  return url.toString();
}

/** Accept raw code, or Claude Code style `code#state`. */
export function parseClaudeAuthCode(raw: string): {
  code: string;
  state?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Вставь код авторизации");
  if (trimmed.includes("#")) {
    const [code, state] = trimmed.split("#", 2);
    if (!code) throw new Error("Неверный формат кода");
    return { code: code.trim(), state: state?.trim() || undefined };
  }
  const q = trimmed.match(/[?&]code=([^&]+)/i);
  if (q) {
    const code = decodeURIComponent(q[1]!);
    const s = trimmed.match(/[?&]state=([^&]+)/i);
    return {
      code,
      state: s ? decodeURIComponent(s[1]!) : undefined,
    };
  }
  return { code: trimmed };
}

export async function exchangeClaudeAuthCode(opts: {
  code: string;
  codeVerifier: string;
  state: string;
}): Promise<ClaudeTokens> {
  const body = {
    grant_type: "authorization_code",
    code: opts.code,
    client_id: CLAUDE_OAUTH_CLIENT_ID,
    redirect_uri: CLAUDE_REDIRECT_URI,
    code_verifier: opts.codeVerifier,
    state: opts.state,
  };
  const res = await fetch(CLAUDE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CLAUDE_UA,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Claude OAuth exchange HTTP " + res.status);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const accessToken = String(data.access_token ?? data.accessToken ?? "").trim();
  const refreshToken = String(
    data.refresh_token ?? data.refreshToken ?? ""
  ).trim();
  if (!accessToken) throw new Error("Claude OAuth: нет access_token");
  return {
    accessToken,
    refreshToken: refreshToken || undefined,
  };
}