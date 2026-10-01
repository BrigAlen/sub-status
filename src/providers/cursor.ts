import type { CursorSecret, ProviderFetchResult, UsageWindow } from "./types";

const USAGE_SUMMARY = "https://cursor.com/api/usage-summary";
const USAGE_FALLBACK = "https://cursor.com/api/usage";

function toPercent(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const pct = v <= 1 ? v * 100 : v;
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
}

function parseResetsAt(v: unknown): Date | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    // ms or seconds
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

export function parseCursorSecret(plaintext: string): CursorSecret {
  const trimmed = plaintext.trim();
  if (trimmed.startsWith("{")) {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const sessionToken = String(
      j.sessionToken ??
        j.WorkosCursorSessionToken ??
        j.token ??
        j.cookie ??
        ""
    ).trim();
    if (!sessionToken) throw new Error("Cursor: нет sessionToken в JSON");
    return { sessionToken };
  }
  // allow raw cookie value, optionally with name prefix
  let token = trimmed;
  const m = trimmed.match(/^WorkosCursorSessionToken=(.+)$/i);
  if (m) token = m[1]!.trim();
  if (!token) throw new Error("Cursor: пустой cookie");
  return { sessionToken: token };
}

function cookieHeader(token: string): string {
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
      "User-Agent":
        "Mozilla/5.0 (compatible; SubStatus/1.0; +https://localhost)",
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

function pickUsedPercent(obj: Record<string, unknown>): number | null {
  const candidates = [
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
  // plan-based: used / limit
  const used = obj.used ?? obj.numRequests ?? obj.totalRequests ?? obj.requestsUsed;
  const limit =
    obj.limit ?? obj.maxRequestUsage ?? obj.maxRequests ?? obj.requestLimit;
  if (typeof used === "number" && typeof limit === "number" && limit > 0) {
    return toPercent((used / limit) * 100);
  }
  return null;
}

function windowsFromPayload(data: unknown): UsageWindow[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  // usage-summary style
  const plan = (root.plan ?? root.membershipType ?? root.subscription) as
    | Record<string, unknown>
    | string
    | undefined;

  const windows: UsageWindow[] = [];

  // nested individual / premium usage
  const buckets: Array<[string, unknown]> = [
    ["premium", root.premium ?? root.gpt4 ?? root.premiumUsage],
    ["fast", root.fast ?? root.fastRequests],
    ["plan", root.planUsage ?? root.usage],
    ["summary", root],
  ];

  for (const [label, block] of buckets) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const used = pickUsedPercent(b);
    if (used == null && label === "summary") continue;
    if (used == null) continue;
    const resetsAt = parseResetsAt(
      b.resetsAt ?? b.resets_at ?? b.startOfMonth ?? b.nextReset ?? root.startOfMonth
    );
    windows.push({
      label: label === "summary" ? "cursor pool" : label,
      usedPercent: used,
      remainingText:
        Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
      resetsAt,
    });
    break; // primary window is enough for card
  }

  // array of models
  if (windows.length === 0 && Array.isArray(root.models)) {
    for (const m of root.models) {
      if (!m || typeof m !== "object") continue;
      const b = m as Record<string, unknown>;
      const used = pickUsedPercent(b);
      if (used == null) continue;
      windows.push({
        label: String(b.name ?? b.model ?? "model"),
        usedPercent: used,
        remainingText:
          Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
        resetsAt: parseResetsAt(b.resetsAt ?? root.startOfMonth),
      });
    }
  }

  // top-level percent
  if (windows.length === 0) {
    const used = pickUsedPercent(root);
    if (used != null) {
      windows.push({
        label:
          typeof plan === "string"
            ? plan
            : plan && typeof plan === "object"
              ? String((plan as Record<string, unknown>).name ?? "cursor pool")
              : "cursor pool",
        usedPercent: used,
        remainingText:
          Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
        resetsAt: parseResetsAt(root.startOfMonth ?? root.resetsAt),
      });
    }
  }

  return windows;
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
    let result = await getJson(USAGE_SUMMARY, secret.sessionToken);
    if (!result.ok) {
      result = await getJson(USAGE_FALLBACK, secret.sessionToken);
    }
    if (!result.ok) {
      const hint =
        result.status === 401 || result.status === 302 || result.status === 303
          ? " (cookie истёк — вставьте заново в Настройках)"
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
      return {
        provider: "cursor",
        windows: [],
        raw: result.data,
        error: "Cursor: неожиданный формат ответа",
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
  return JSON.stringify({ sessionToken: s.sessionToken });
}
