import type { CursorSecret, ProviderFetchResult, UsageWindow } from "./types";

const USAGE_SUMMARY = "https://cursor.com/api/usage-summary";
const USAGE_FALLBACK = "https://cursor.com/api/usage";

function toPercent(v: unknown): number | null {
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return toPercent(Number(v));
  }
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const pct = v <= 1 && v >= 0 ? v * 100 : v;
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
}

function parseResetsAt(v: unknown): Date | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Normalize pasted cookie: strip name, decode once if URL-encoded. */
export function normalizeCursorSessionToken(raw: string): string {
  let token = raw.trim();
  const m = token.match(/^WorkosCursorSessionToken=(.+)$/i);
  if (m) token = m[1]!.trim();
  // DevTools often copies user_xxx%3A%3AeyJ...
  if (/%3A%3A/i.test(token) || /%2[Ff]/i.test(token)) {
    try {
      token = decodeURIComponent(token);
    } catch {
      // keep raw
    }
  }
  return token;
}

export function parseCursorSecret(plaintext: string): CursorSecret {
  const trimmed = plaintext.trim();
  if (trimmed.startsWith("{")) {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const sessionToken = normalizeCursorSessionToken(
      String(
        j.sessionToken ??
          j.WorkosCursorSessionToken ??
          j.token ??
          j.cookie ??
          ""
      )
    );
    if (!sessionToken) throw new Error("Cursor: нет sessionToken в JSON");
    return { sessionToken };
  }
  const sessionToken = normalizeCursorSessionToken(trimmed);
  if (!sessionToken) throw new Error("Cursor: пустой cookie");
  return { sessionToken };
}

function cookieHeader(token: string): string {
  // Cookie values with :: / JWT are fine unquoted for fetch
  return "WorkosCursorSessionToken=" + token;
}

async function getJson(
  url: string,
  token: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookieHeader(token),
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Origin: "https://cursor.com",
      Referer: "https://cursor.com/dashboard?tab=usage",
    },
    cache: "no-store",
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) {
    return { ok: false, status: res.status, data: null };
  }
  let data: unknown = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await res.text();
      data = text ? { text: text.slice(0, 500) } : null;
    } catch {
      data = null;
    }
  }
  return { ok: res.ok, status: res.status, data };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function pickUsedPercent(obj: Record<string, unknown>): number | null {
  const candidates = [
    obj.totalPercentUsed,
    obj.apiPercentUsed,
    obj.autoPercentUsed,
    obj.usedPercent,
    obj.used_percent,
    obj.percentageUsed,
    obj.percentage_used,
    obj.percentUsed,
    obj.utilization,
    obj.usagePercent,
  ];
  for (const c of candidates) {
    const p = toPercent(c);
    if (p != null) return p;
  }
  const used = Number(obj.used ?? obj.numRequests ?? obj.totalRequests ?? NaN);
  const limit = Number(
    obj.limit ?? obj.maxRequestUsage ?? obj.maxRequests ?? obj.requestLimit ?? NaN
  );
  if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0) {
    return toPercent((used / limit) * 100);
  }
  return null;
}

function windowFromUsageBlock(
  label: string,
  block: Record<string, unknown> | null,
  resetsAt: Date | null
): UsageWindow | null {
  if (!block) return null;
  if (block.enabled === false) return null;
  const used = pickUsedPercent(block);
  if (used == null) return null;
  const remaining =
    typeof block.remaining === "number" && typeof block.limit === "number"
      ? Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно"
      : Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно";
  return {
    label,
    usedPercent: used,
    remainingText: remaining,
    resetsAt,
  };
}

/** Parse GET /api/usage-summary (current dashboard shape). */
function windowsFromUsageSummary(root: Record<string, unknown>): UsageWindow[] {
  const windows: UsageWindow[] = [];
  const resetsAt = parseResetsAt(
    root.billingCycleEnd ?? root.billingCycleStart ?? root.startOfMonth
  );
  const membership =
    typeof root.membershipType === "string" ? root.membershipType : "plan";

  if (root.isUnlimited === true) {
    windows.push({
      label: membership + " · unlimited",
      usedPercent: 0,
      remainingText: "без лимита",
      resetsAt,
    });
    return windows;
  }

  const individual = asRecord(root.individualUsage);
  if (individual) {
    const plan =
      windowFromUsageBlock(
        membership + " plan",
        asRecord(individual.plan),
        resetsAt
      ) ??
      windowFromUsageBlock(
        membership + " overall",
        asRecord(individual.overall),
        resetsAt
      );
    if (plan) windows.push(plan);

    const onDemand = windowFromUsageBlock(
      "on-demand",
      asRecord(individual.onDemand),
      resetsAt
    );
    if (onDemand && windows.length === 0) windows.push(onDemand);
  }

  if (windows.length === 0) {
    const team = asRecord(root.teamUsage);
    if (team) {
      const pooled = windowFromUsageBlock(
        "team pooled",
        asRecord(team.pooled),
        resetsAt
      );
      const overall = windowFromUsageBlock(
        "team",
        asRecord(team.overall),
        resetsAt
      );
      const onDemand = windowFromUsageBlock(
        "team on-demand",
        asRecord(team.onDemand),
        resetsAt
      );
      if (pooled) windows.push(pooled);
      else if (overall) windows.push(overall);
      else if (onDemand) windows.push(onDemand);
    }
  }

  return windows;
}

function windowsFromLegacyUsage(root: Record<string, unknown>): UsageWindow[] {
  const windows: UsageWindow[] = [];
  const gpt4 = asRecord(root["gpt-4"] ?? root.gpt4 ?? root.premium);
  if (gpt4) {
    const used = pickUsedPercent(gpt4);
    if (used != null) {
      windows.push({
        label: "premium",
        usedPercent: used,
        remainingText:
          Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
        resetsAt: parseResetsAt(root.startOfMonth ?? gpt4.resetsAt),
      });
    }
  }
  return windows;
}

function windowsFromPayload(data: unknown): UsageWindow[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  // Modern dashboard: individualUsage / teamUsage
  if (root.individualUsage || root.teamUsage || root.billingCycleEnd) {
    const modern = windowsFromUsageSummary(root);
    if (modern.length > 0) return modern;
  }

  // Legacy /api/usage
  const legacy = windowsFromLegacyUsage(root);
  if (legacy.length > 0) return legacy;

  const buckets: Array<[string, unknown]> = [
    ["premium", root.premium ?? root.gpt4 ?? root.premiumUsage],
    ["fast", root.fast ?? root.fastRequests],
    ["plan", root.planUsage ?? root.usage],
  ];
  for (const [label, block] of buckets) {
    const b = asRecord(block);
    if (!b) continue;
    const used = pickUsedPercent(b);
    if (used == null) continue;
    return [
      {
        label,
        usedPercent: used,
        remainingText:
          Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
        resetsAt: parseResetsAt(
          b.resetsAt ?? root.startOfMonth ?? root.billingCycleEnd
        ),
      },
    ];
  }

  const used = pickUsedPercent(root);
  if (used != null) {
    return [
      {
        label: "cursor pool",
        usedPercent: used,
        remainingText:
          Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
        resetsAt: parseResetsAt(root.startOfMonth ?? root.billingCycleEnd),
      },
    ];
  }
  return [];
}

/**
 * Fetch Cursor usage via session cookie WorkosCursorSessionToken.
 * Cookie expires — user must re-paste in Settings when 401/redirect.
 * Never logs the cookie value.
 */
export async function fetchCursorUsage(
  secret: CursorSecret
): Promise<ProviderFetchResult> {
  try {
    const token = normalizeCursorSessionToken(secret.sessionToken);
    let result = await getJson(USAGE_SUMMARY, token);
    if (!result.ok) {
      result = await getJson(USAGE_FALLBACK, token);
    }
    if (!result.ok) {
      const hint =
        result.status === 401 || result.status === 302 || result.status === 303
          ? " (cookie истёк — вставь новый в Настройках)"
          : "";
      return {
        provider: "cursor",
        windows: [],
        raw: result.data,
        error: "Cursor usage HTTP " + result.status + hint,
      };
    }
    const windows = windowsFromPayload(result.data);
    if (windows.length === 0) {
      const keys =
        result.data && typeof result.data === "object"
          ? Object.keys(result.data as object).slice(0, 8).join(",")
          : "empty";
      return {
        provider: "cursor",
        windows: [],
        raw: result.data,
        error: "Cursor: не удалось разобрать ответ (" + keys + ")",
      };
    }
    return { provider: "cursor", windows, raw: result.data };
  } catch (e) {
    return {
      provider: "cursor",
      windows: [],
      raw: null,
      error: e instanceof Error ? e.message : "Cursor: ошибка запроса",
    };
  }
}

export function serializeCursorSecret(s: CursorSecret): string {
  return JSON.stringify({
    sessionToken: normalizeCursorSessionToken(s.sessionToken),
  });
}