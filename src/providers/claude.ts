import type {
  ClaudeTokens,
  ProviderBilling,
  ProviderFetchResult,
  UsageWindow,
} from "./types";

const CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const CLAUDE_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const CLAUDE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_UA = "claude-code/2.1.72";
const CLAUDE_BETA = "oauth-2025-04-20";

function toPercent(utilization: unknown): number | null {
  if (typeof utilization !== "number" || !Number.isFinite(utilization)) return null;
  // API may return 0..1 or 0..100
  const pct = utilization <= 1 ? utilization * 100 : utilization;
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
}

function parseResetsAt(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function windowFrom(
  key: string,
  label: string,
  block: Record<string, unknown> | undefined
): UsageWindow | null {
  if (!block || typeof block !== "object") return null;
  const used = toPercent(block.utilization ?? block.used_percent ?? block.percentage);
  const resetsAt = parseResetsAt(block.resets_at ?? block.resetsAt);
  const remaining =
    used != null ? Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно" : null;
  return {
    label,
    usedPercent: used,
    remainingText: remaining,
    resetsAt,
  };
}


function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Billing from Claude usage payload. Usage API has no next-billing date and no
 * list price — only plan hints (e.g. seven_day_opus => Max). Never invent prices.
 */
export function billingFromClaudeUsage(data: unknown): ProviderBilling {
  const root = asRecord(data) ?? {};
  const opus = asRecord(root.seven_day_opus ?? root.sevenDayOpus);
  const hasOpus = Boolean(opus);
  const hasFive = Boolean(asRecord(root.five_hour ?? root.fiveHour));
  const hasWeek = Boolean(
    asRecord(root.seven_day ?? root.sevenDay ?? root.week ?? root.weekly)
  );
  const billing: ProviderBilling = {};
  if (hasOpus) billing.name = "Claude Max";
  else if (hasFive || hasWeek) billing.name = "Claude Pro";
  // Usage API has no list price and no next-billing date — never invent them.
  billing.currency = "USD";
  billing.billingPeriod = "monthly";
  return billing;
}

function parseUsagePayload(data: unknown): UsageWindow[] {
  const root = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const windows: UsageWindow[] = [];
  const five = windowFrom(
    "five_hour",
    "5ч окно",
    (root.five_hour ?? root.fiveHour) as Record<string, unknown> | undefined
  );
  const seven = windowFrom(
    "seven_day",
    "неделя",
    (root.seven_day ?? root.sevenDay ?? root.week ?? root.weekly) as
      | Record<string, unknown>
      | undefined
  );
  if (five) windows.push(five);
  if (seven) windows.push(seven);
  if (windows.length === 0 && typeof root.utilization === "number") {
    const used = toPercent(root.utilization);
    windows.push({
      label: "usage",
      usedPercent: used,
      remainingText:
        used != null ? Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно" : null,
      resetsAt: parseResetsAt(root.resets_at),
    });
  }
  return windows;
}

export function parseClaudeSecret(plaintext: string): ClaudeTokens {
  const trimmed = plaintext.trim();
  if (trimmed.startsWith("{")) {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const accessToken = String(
      j.accessToken ?? j.access_token ?? j.token ?? ""
    ).trim();
    const refreshToken = String(
      j.refreshToken ?? j.refresh_token ?? ""
    ).trim();
    if (!accessToken) throw new Error("Claude: нет accessToken в JSON");
    return {
      accessToken,
      refreshToken: refreshToken || undefined,
    };
  }
  // plain access token only
  if (!trimmed) throw new Error("Claude: пустой токен");
  return { accessToken: trimmed };
}

async function fetchUsage(accessToken: string): Promise<Response> {
  return fetch(CLAUDE_USAGE_URL, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + accessToken,
      "anthropic-beta": CLAUDE_BETA,
      "User-Agent": CLAUDE_UA,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

export async function refreshClaudeAccessToken(
  refreshToken: string
): Promise<ClaudeTokens> {
  const res = await fetch(CLAUDE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CLAUDE_UA,
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLAUDE_CLIENT_ID,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Claude refresh failed: HTTP " + res.status);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const accessToken = String(data.access_token ?? data.accessToken ?? "").trim();
  const newRefresh = String(data.refresh_token ?? data.refreshToken ?? refreshToken).trim();
  if (!accessToken) throw new Error("Claude refresh: нет access_token");
  return { accessToken, refreshToken: newRefresh || refreshToken };
}

/**
 * Fetch Claude subscription usage. On 401 tries refresh_token once.
 * Never logs tokens. Returns updatedTokens when refresh succeeded.
 */
export async function fetchClaudeUsage(
  tokens: ClaudeTokens
): Promise<ProviderFetchResult & { updatedTokens?: ClaudeTokens }> {
  try {
    let access = tokens.accessToken;
    let updatedTokens: ClaudeTokens | undefined;
    let res = await fetchUsage(access);

    // Rate limited on usage — do not burn refresh
    if (res.status === 429) {
      return {
        provider: "claude",
        windows: [],
        raw: null,
        error: "Claude: слишком много запросов (429). Подожди минуту и обнови снова.",
      };
    }

    if (res.status === 401 && tokens.refreshToken) {
      try {
        updatedTokens = await refreshClaudeAccessToken(tokens.refreshToken);
        access = updatedTokens.accessToken;
        res = await fetchUsage(access);
      } catch (re) {
        const msg = re instanceof Error ? re.message : "Claude refresh failed";
        // 429 on refresh is temporary — keep existing tokens
        if (/\b429\b/.test(msg)) {
          return {
            provider: "claude",
            windows: [],
            raw: null,
            error:
              "Claude: лимит на обновление токена (429). Подожди и нажми «Обновить лимиты» снова — переподключать OAuth не нужно.",
          };
        }
        return {
          provider: "claude",
          windows: [],
          raw: null,
          error: msg,
        };
      }
    }

    if (res.status === 429) {
      return {
        provider: "claude",
        windows: [],
        raw: null,
        error: "Claude: слишком много запросов (429). Подожди минуту.",
        updatedTokens,
      };
    }

    if (!res.ok) {
      return {
        provider: "claude",
        windows: [],
        raw: null,
        error: "Claude usage HTTP " + res.status,
        updatedTokens,
      };
    }

    const data = await res.json();
    const windows = parseUsagePayload(data);
    if (windows.length === 0) {
      return {
        provider: "claude",
        windows: [],
        raw: data,
        error: "Claude: неизвестный формат ответа",
        updatedTokens,
      };
    }
    return { provider: "claude", windows, raw: data, updatedTokens };
  } catch (e) {
    return {
      provider: "claude",
      windows: [],
      raw: null,
      error: e instanceof Error ? e.message : "Claude: ошибка запроса",
    };
  }
}

export function serializeClaudeTokens(t: ClaudeTokens): string {
  return JSON.stringify({
    accessToken: t.accessToken,
    refreshToken: t.refreshToken ?? "",
  });
}
