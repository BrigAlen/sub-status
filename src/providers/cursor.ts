import type {
  CursorSecret,
  ProviderBilling,
  ProviderFetchResult,
  UsageWindow,
} from "./types";

const USAGE_SUMMARY = "https://cursor.com/api/usage-summary";
const USAGE_FALLBACK = "https://cursor.com/api/usage";

function toPercent(v: unknown): number | null {
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return toPercent(Number(v));
  }
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  // Values like 0.37 mean 37%; values like 37 mean 37%
  const pct = v > 0 && v <= 1 ? v * 100 : v;
  if (pct < 0 || pct > 100) {
    // might be cents ratio later — still clamp display
    return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
  }
  return Math.round(pct * 100) / 100;
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

export function normalizeCursorSessionToken(raw: string): string {
  let token = raw.trim();
  const m = token.match(/^WorkosCursorSessionToken=(.+)$/i);
  if (m) token = m[1]!.trim();
  // Keep both forms: try decode only when clearly percent-encoded
  if (/%[0-9A-Fa-f]{2}/.test(token)) {
    try {
      const once = decodeURIComponent(token);
      // Prefer decoded if it yields user_…::jwt
      if (once.includes("::") || once.startsWith("user_")) token = once;
    } catch {
      // keep encoded
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
  return "WorkosCursorSessionToken=" + encodeURIComponent(token).replace(/%3A/gi, ":").replace(/%2F/gi, "/");
}

/** Safer cookie header: if token has ::, send raw; if still encoded, send as-is. */
function buildCookieHeader(token: string): string {
  // Browsers store the cookie value; send exactly what DevTools shows when possible.
  // If we decoded to user_::jwt, re-encode only special chars except we need ::
  if (token.includes("::")) {
    return "WorkosCursorSessionToken=" + token;
  }
  return "WorkosCursorSessionToken=" + token;
}

async function getJson(
  url: string,
  token: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: buildCookieHeader(token),
      Accept: "application/json, text/plain, */*",
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
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { text: text.slice(0, 400) };
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
  const used = Number(obj.used ?? obj.numRequests ?? obj.numRequestsTotal ?? NaN);
  const limit = Number(
    obj.limit ?? obj.maxRequestUsage ?? obj.maxRequests ?? obj.requestLimit ?? NaN
  );
  if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0) {
    return toPercent((used / limit) * 100);
  }
  // breakdown.included / total
  const breakdown = asRecord(obj.breakdown);
  if (breakdown) {
    const included = Number(breakdown.included ?? NaN);
    const total = Number(breakdown.total ?? NaN);
    if (Number.isFinite(included) && Number.isFinite(total) && total > 0) {
      // "used" style: included consumed against total allowance
      const usedAmt = Number(obj.used ?? included);
      if (Number.isFinite(usedAmt)) return toPercent((usedAmt / total) * 100);
    }
  }
  return null;
}

function percentFromDisplayMessage(msg: unknown): number | null {
  if (typeof msg !== "string") return null;
  const m = msg.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  return toPercent(Number(m[1]!.replace(",", ".")));
}

function outlineKeys(data: unknown, depth = 0): string {
  if (depth > 2 || !data || typeof data !== "object") return typeof data;
  if (Array.isArray(data)) return "array(" + data.length + ")";
  const o = data as Record<string, unknown>;
  return Object.keys(o)
    .slice(0, 12)
    .map((k) => {
      const v = o[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return k + "{" + Object.keys(v as object).slice(0, 6).join(",") + "}";
      }
      return k;
    })
    .join("|");
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
  return {
    label,
    usedPercent: used,
    remainingText:
      Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
    resetsAt,
  };
}

/** Deep-scan any object for a usable percent / used+limit pair. */
function deepFindUsage(
  node: unknown,
  resetsAt: Date | null,
  path: string,
  out: UsageWindow[],
  depth: number
) {
  if (out.length > 0 || depth > 5 || !node || typeof node !== "object") return;
  if (Array.isArray(node)) return;
  const rec = node as Record<string, unknown>;
  if (rec.enabled === false) return;
  const pct = pickUsedPercent(rec);
  if (pct != null && ("used" in rec || "limit" in rec || "totalPercentUsed" in rec || "apiPercentUsed" in rec)) {
    out.push({
      label: path || "cursor",
      usedPercent: pct,
      remainingText:
        Math.max(0, Math.round((100 - pct) * 10) / 10) + "% свободно",
      resetsAt,
    });
    return;
  }
  for (const [k, v] of Object.entries(rec)) {
    if (v && typeof v === "object") {
      deepFindUsage(v, resetsAt, path ? path + "." + k : k, out, depth + 1);
      if (out.length > 0) return;
    }
  }
}


function membershipDisplayName(membership: string): string {
  const key = membership.trim().toLowerCase().replace(/[_\s]+/g, "-");
  const map: Record<string, string> = {
    free: "Cursor Free",
    hobby: "Cursor Hobby",
    pro: "Cursor Pro",
    "pro-plus": "Cursor Pro Plus",
    proplus: "Cursor Pro Plus",
    plus: "Cursor Pro Plus",
    ultra: "Cursor Ultra",
    business: "Cursor Business",
    team: "Cursor Team",
    enterprise: "Cursor Enterprise",
  };
  if (map[key]) return map[key];
  const pretty = membership
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty.toLowerCase().startsWith("cursor") ? pretty : "Cursor " + pretty;
}

function toBillingDate(v: unknown): string | null {
  const d = parseResetsAt(v);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Real billing fields from usage-summary. Price is not in this API — do not invent.
 * nextBillingAt comes from billingCycleEnd when present.
 */
export function billingFromCursorUsage(data: unknown): ProviderBilling {
  let root = asRecord(data) ?? {};
  const nested = asRecord(root.data);
  if (nested && (nested.individualUsage || nested.billingCycleEnd || nested.membershipType)) {
    root = nested;
  }
  const billing: ProviderBilling = {};
  const membership =
    typeof root.membershipType === "string" ? root.membershipType.trim() : "";
  if (membership) billing.name = membershipDisplayName(membership);
  const next = toBillingDate(
    root.billingCycleEnd ?? root.billing_cycle_end ?? root.nextBillingDate
  );
  if (next) billing.nextBillingAt = next;
  // usage-summary has no list price — never invent amountCents.
  billing.currency = "USD";
  billing.billingPeriod = "monthly";
  return billing;
}

function windowsFromPayload(data: unknown): UsageWindow[] {
  if (!data || typeof data !== "object") return [];
  // unwrap { data: {...} }
  let root = data as Record<string, unknown>;
  const nested = asRecord(root.data);
  if (nested && (nested.individualUsage || nested.billingCycleEnd)) {
    root = nested;
  }

  const windows: UsageWindow[] = [];
  const resetsAt = parseResetsAt(
    root.billingCycleEnd ?? root.billingCycleStart ?? root.startOfMonth
  );
  const membership =
    typeof root.membershipType === "string" ? root.membershipType : "plan";

  if (root.isUnlimited === true) {
    return [
      {
        label: membership + " · unlimited",
        usedPercent: 0,
        remainingText: "без лимита",
        resetsAt,
      },
    ];
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
      if (pooled) windows.push(pooled);
      else if (overall) windows.push(overall);
    }
  }

  if (windows.length === 0) {
    const fromMsg =
      percentFromDisplayMessage(root.autoModelSelectedDisplayMessage) ??
      percentFromDisplayMessage(root.namedModelSelectedDisplayMessage);
    if (fromMsg != null) {
      windows.push({
        label: membership,
        usedPercent: fromMsg,
        remainingText:
          Math.max(0, Math.round((100 - fromMsg) * 10) / 10) + "% свободно",
        resetsAt,
      });
    }
  }

  if (windows.length === 0) {
    deepFindUsage(root, resetsAt, "cursor", windows, 0);
  }

  // legacy /api/usage
  if (windows.length === 0) {
    const gpt4 = asRecord(root["gpt-4"] ?? root.gpt4);
    if (gpt4) {
      const used = pickUsedPercent(gpt4);
      if (used != null) {
        windows.push({
          label: "premium",
          usedPercent: used,
          remainingText:
            Math.max(0, Math.round((100 - used) * 10) / 10) + "% свободно",
          resetsAt: parseResetsAt(root.startOfMonth),
        });
      }
    }
  }

  return windows;
}

export async function fetchCursorUsage(
  secret: CursorSecret
): Promise<ProviderFetchResult> {
  try {
    const token = normalizeCursorSessionToken(secret.sessionToken);
    let result = await getJson(USAGE_SUMMARY, token);
    if (!result.ok) {
      result = await getJson(USAGE_FALLBACK, token);
    }
    // Also try with user= from token prefix
    if (!result.ok || (result.ok && windowsFromPayload(result.data).length === 0)) {
      const userMatch = token.match(/^(user_[A-Za-z0-9]+)/);
      if (userMatch) {
        const alt = await getJson(
          USAGE_FALLBACK + "?user=" + encodeURIComponent(userMatch[1]!),
          token
        );
        if (alt.ok && windowsFromPayload(alt.data).length > 0) {
          result = alt;
        } else if (!result.ok && alt.ok) {
          result = alt;
        }
      }
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

    if (asRecord(result.data)?.error) {
      return {
        provider: "cursor",
        windows: [],
        raw: result.data,
        error:
          "Cursor: " +
          String(asRecord(result.data)!.error) +
          " — обнови cookie в Настройках",
      };
    }

    const windows = windowsFromPayload(result.data);
    const billing = billingFromCursorUsage(result.data);
    if (windows.length === 0) {
      return {
        provider: "cursor",
        windows: [],
        raw: result.data,
        error:
          "Cursor: неожиданный формат ответа [" +
          outlineKeys(result.data) +
          "]",
        billing,
      };
    }
    return { provider: "cursor", windows, raw: result.data, billing };
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