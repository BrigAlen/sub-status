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

export type ClaudePkce = {
  /** Also used as OAuth `state` (Anthropic requires state === verifier). */
  verifier: string;
  challenge: string;
};

export function generateClaudePkce(): ClaudePkce {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
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
  // Anthropic non-standard: state must equal the PKCE verifier
  url.searchParams.set("state", pkce.verifier);
  return url.toString();
}

/** Accept raw code, or Claude Code style `code#state`. */
export function parseClaudeAuthCode(raw: string): {
  code: string;
  state?: string;
} {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) throw new Error("Вставь код авторизации");
  if (trimmed.includes("#")) {
    const idx = trimmed.indexOf("#");
    const code = trimmed.slice(0, idx).trim();
    const state = trimmed.slice(idx + 1).trim();
    if (!code) throw new Error("Неверный формат кода");
    return { code, state: state || undefined };
  }
  const q = trimmed.match(/[?&]code=([^&#]+)/i);
  if (q) {
    const code = decodeURIComponent(q[1]!);
    const s = trimmed.match(/[?&]state=([^&#]+)/i);
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
    code: opts.code,
    state: opts.state,
    grant_type: "authorization_code",
    client_id: CLAUDE_OAUTH_CLIENT_ID,
    redirect_uri: CLAUDE_REDIRECT_URI,
    code_verifier: opts.codeVerifier,
  };
  const res = await fetch(CLAUDE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const detail =
      typeof data.error === "string"
        ? data.error
        : typeof data.error_description === "string"
          ? data.error_description
          : typeof data.message === "string"
            ? data.message
            : text.slice(0, 200);
    throw new Error(
      "Claude OAuth exchange HTTP " + res.status + (detail ? ": " + detail : "")
    );
  }
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