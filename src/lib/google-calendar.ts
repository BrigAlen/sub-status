import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appSettings,
  providerCredentials,
  subscriptions,
  type Subscription,
} from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const GCAL_PROVIDER = "google_calendar";
const GCAL_LABEL = "oauth";
const SETTINGS_KEY = "google_calendar";

export type GcalSettings = {
  enabled: boolean;
  /** day_of = event on next_billing_at; day_before = previous calendar day */
  remindOn: "day_of" | "day_before";
  calendarId: string;
};

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiry?: number;
};

const DEFAULT_SETTINGS: GcalSettings = {
  enabled: false,
  remindOn: "day_of",
  calendarId: "primary",
};

export async function getGcalSettings(): Promise<GcalSettings> {
  const db = getDb();
  if (!db) return { ...DEFAULT_SETTINGS };
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, SETTINGS_KEY))
    .limit(1);
  if (!rows[0]) return { ...DEFAULT_SETTINGS };
  const v = rows[0].value as Partial<GcalSettings>;
  return {
    enabled: Boolean(v.enabled),
    remindOn: v.remindOn === "day_before" ? "day_before" : "day_of",
    calendarId: typeof v.calendarId === "string" && v.calendarId ? v.calendarId : "primary",
  };
}

export async function setGcalSettings(patch: Partial<GcalSettings>): Promise<GcalSettings> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL требуется");
  const cur = await getGcalSettings();
  const next: GcalSettings = {
    enabled: patch.enabled ?? cur.enabled,
    remindOn: patch.remindOn ?? cur.remindOn,
    calendarId: patch.calendarId ?? cur.calendarId,
  };
  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, SETTINGS_KEY))
    .limit(1);
  if (existing[0]) {
    await db
      .update(appSettings)
      .set({ value: next, updatedAt: new Date() })
      .where(eq(appSettings.key, SETTINGS_KEY));
  } else {
    await db.insert(appSettings).values({
      key: SETTINGS_KEY,
      value: next,
      updatedAt: new Date(),
    });
  }
  return next;
}

function oauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleOAuthConfigured(): boolean {
  return oauthConfigured();
}

/** Strip trailing slash from app base URL used for OAuth redirect_uri. */
export function normalizeOAuthBaseUrl(base: string): string {
  return base.replace(/\/$/, "");
}

function isLocalhostHost(hostOrUrl: string): boolean {
  try {
    const host = hostOrUrl.includes("://")
      ? new URL(hostOrUrl).hostname
      : hostOrUrl.split(":")[0];
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(hostOrUrl);
  }
}

/**
 * Resolve OAuth redirect base at runtime (not build-time NEXT_PUBLIC alone).
 * Prefer APP_URL (server-only), then NEXT_PUBLIC_APP_URL, then x-forwarded-*,
 * then req.url origin. Never prefer localhost when a public APP_URL is set
 * (Render binds PORT to localhost internally).
 * Render: set APP_URL=https://sub-status.onrender.com (same as public URL).
 */
export function resolveOAuthAppBase(req?: Request): string {
  const fromEnv = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  // Public env always wins — never fall through to localhost req.origin.
  if (fromEnv && !isLocalhostHost(fromEnv)) {
    return normalizeOAuthBaseUrl(fromEnv);
  }

  let fromForwarded: string | null = null;
  let fromReqOrigin: string | null = null;

  if (req) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host");
    if (proto && host) {
      const candidate = normalizeOAuthBaseUrl(proto + "://" + host);
      if (!isLocalhostHost(host)) return candidate;
      fromForwarded = candidate;
    }
    try {
      const origin = normalizeOAuthBaseUrl(new URL(req.url).origin);
      if (!isLocalhostHost(origin)) return origin;
      fromReqOrigin = origin;
    } catch {
      /* ignore */
    }
  }

  // Hardening: resolved base was localhost but env has a public URL — use env.
  if (fromEnv && !isLocalhostHost(fromEnv)) {
    return normalizeOAuthBaseUrl(fromEnv);
  }
  if (fromEnv) return normalizeOAuthBaseUrl(fromEnv);

  // If only localhost available, use NEXT_PUBLIC_APP_URL when it points at onrender
  // (do not hardcode the hostname unless it already appears in env).
  const nextPublic = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (nextPublic && /onrender\.com/i.test(nextPublic) && !isLocalhostHost(nextPublic)) {
    return normalizeOAuthBaseUrl(nextPublic);
  }

  // Last resort for local dev only.
  return fromForwarded || fromReqOrigin || "http://localhost:3000";
}

function oauthRedirectUri(baseUrl: string): string {
  return normalizeOAuthBaseUrl(baseUrl) + "/api/google/oauth/callback";
}

export function getGoogleAuthUrl(state: string, baseUrl: string): string {
  if (!oauthConfigured()) throw new Error("GOOGLE_CLIENT_ID/SECRET не заданы");
  const redirect = oauthRedirectUri(baseUrl);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}

export async function exchangeGoogleCode(code: string, baseUrl: string): Promise<GoogleTokens> {
  const redirect = oauthRedirectUri(baseUrl);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Google OAuth token exchange HTTP " + res.status);
  const data = (await res.json()) as Record<string, unknown>;
  const accessToken = String(data.access_token || "");
  const refreshToken = String(data.refresh_token || "");
  if (!accessToken || !refreshToken) {
    throw new Error("Google OAuth: нет refresh_token (повторите с consent)");
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    accessToken,
    refreshToken,
    expiry: Date.now() + expiresIn * 1000,
  };
}

/** Ensure a subscription row exists for anchoring google_calendar credentials. */
async function ensureGcalAnchorSub() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL требуется");
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.provider, "google"))
    .limit(1);
  if (existing[0]) return existing[0];
  const next = new Date();
  next.setDate(next.getDate() + 30);
  const rows = await db
    .insert(subscriptions)
    .values({
      name: "Google One",
      provider: "google",
      kind: "billing_only",
      amountCents: 29900,
      currency: "RUB",
      billingPeriod: "monthly",
      nextBillingAt: next.toISOString().slice(0, 10),
      notes: "Автосоздано для Google Calendar OAuth",
      isActive: true,
      calendarRemind: true,
    })
    .returning();
  return rows[0]!;
}

export async function saveGoogleTokens(tokens: GoogleTokens): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL требуется");
  const sub = await ensureGcalAnchorSub();
  const enc = encryptSecret(JSON.stringify(tokens));
  const existing = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.provider, GCAL_PROVIDER),
        eq(providerCredentials.label, GCAL_LABEL)
      )
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(providerCredentials)
      .set({
        subscriptionId: sub.id,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        updatedAt: new Date(),
      })
      .where(eq(providerCredentials.id, existing[0].id));
  } else {
    await db.insert(providerCredentials).values({
      subscriptionId: sub.id,
      provider: GCAL_PROVIDER,
      label: GCAL_LABEL,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
    });
  }
}

export async function loadGoogleTokens(): Promise<GoogleTokens | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.provider, GCAL_PROVIDER),
        eq(providerCredentials.label, GCAL_LABEL)
      )
    )
    .limit(1);
  if (!rows[0]) return null;
  const plain = decryptSecret({
    ciphertext: rows[0].ciphertext,
    iv: rows[0].iv,
    authTag: rows[0].authTag,
  });
  const j = JSON.parse(plain) as GoogleTokens;
  if (!j.refreshToken) return null;
  return j;
}

export async function googleCalendarConnected(): Promise<boolean> {
  return Boolean(await loadGoogleTokens());
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Google token refresh HTTP " + res.status);
  const data = (await res.json()) as Record<string, unknown>;
  const accessToken = String(data.access_token || "");
  if (!accessToken) throw new Error("Google refresh: нет access_token");
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    accessToken,
    refreshToken,
    expiry: Date.now() + expiresIn * 1000,
  };
}

async function getValidAccessToken(): Promise<string> {
  const tokens = await loadGoogleTokens();
  if (!tokens) throw new Error("Google Calendar не подключён");
  if (tokens.expiry && tokens.expiry > Date.now() + 60_000) {
    return tokens.accessToken;
  }
  const next = await refreshAccessToken(tokens.refreshToken);
  await saveGoogleTokens(next);
  return next.accessToken;
}

function eventDateFor(sub: Subscription, remindOn: GcalSettings["remindOn"]): string | null {
  if (!sub.nextBillingAt) return null;
  if (remindOn === "day_of") return sub.nextBillingAt;
  const d = new Date(sub.nextBillingAt + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function eventIdFor(subId: string): string {
  // Google event ids: base32hex-ish, start with letter
  const hex = subId.replace(/-/g, "").toLowerCase();
  return "substatus" + hex.slice(0, 26);
}

/** Google all-day events use exclusive end date (next calendar day). */
function exclusiveEndDate(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return "";
  }
}

export async function syncPaymentReminders(): Promise<{
  ok: boolean;
  upserted: number;
  skipped: number;
  error?: string;
  errors?: string[];
}> {
  try {
    const settings = await getGcalSettings();
    if (!settings.enabled) {
      return { ok: true, upserted: 0, skipped: 0, error: "Напоминания выключены" };
    }
    if (!oauthConfigured()) {
      return { ok: false, upserted: 0, skipped: 0, error: "GOOGLE_CLIENT_ID/SECRET не заданы" };
    }
    const access = await getValidAccessToken();
    const db = getDb();
    if (!db) return { ok: false, upserted: 0, skipped: 0, error: "Нет БД" };

    const all = await db.select().from(subscriptions);
    const targets = all.filter(
      (s) => s.isActive && s.calendarRemind && s.nextBillingAt
    );

    if (targets.length === 0) {
      return {
        ok: true,
        upserted: 0,
        skipped: 0,
        error:
          "Нет подписок для синхронизации: нужны isActive, calendarRemind и nextBillingAt",
      };
    }

    let upserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const cal = encodeURIComponent(settings.calendarId || "primary");

    for (const sub of targets) {
      const day = eventDateFor(sub, settings.remindOn);
      if (!day) {
        skipped += 1;
        continue;
      }
      const id = eventIdFor(sub.id);
      const amount =
        sub.amountCents != null
          ? (sub.amountCents / 100).toFixed(0) + " " + sub.currency
          : "";
      const summary = "Оплата: " + sub.name + (amount ? " (" + amount + ")" : "");
      const description =
        "Напоминание Sub Status.\nПодписка: " +
        sub.name +
        "\nПровайдер: " +
        sub.provider +
        "\nДата оплаты: " +
        sub.nextBillingAt +
        (settings.remindOn === "day_before" ? "\n(событие за день до оплаты)" : "");

      const body = {
        id,
        summary,
        description,
        start: { date: day },
        // Google Calendar all-day end is exclusive → next day
        end: { date: exclusiveEndDate(day) },
        transparency: "transparent",
      };

      const authHeaders = {
        Authorization: "Bearer " + access,
        "Content-Type": "application/json",
      };
      const patchUrl =
        "https://www.googleapis.com/calendar/v3/calendars/" +
        cal +
        "/events/" +
        id;
      const insertUrl =
        "https://www.googleapis.com/calendar/v3/calendars/" + cal + "/events";

      const patchRes = await fetch(patchUrl, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (patchRes.ok) {
        upserted += 1;
        continue;
      }

      const patchErr = await readErrorBody(patchRes);
      console.error(
        "[gcal] PUT failed",
        sub.name,
        id,
        patchRes.status,
        patchErr
      );

      // 404: create; 400/other: try POST once with same (fixed) body
      const ins = await fetch(insertUrl, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (ins.ok) {
        upserted += 1;
        continue;
      }
      const insErr = await readErrorBody(ins);
      console.error(
        "[gcal] POST failed",
        sub.name,
        id,
        ins.status,
        insErr
      );
      const detail =
        sub.name +
        ": PUT " +
        patchRes.status +
        (patchErr ? " " + patchErr.slice(0, 120) : "") +
        "; POST " +
        ins.status +
        (insErr ? " " + insErr.slice(0, 120) : "");
      if (errors.length < 5) errors.push(detail);
      skipped += 1;
    }

    return {
      ok: true,
      upserted,
      skipped,
      ...(errors.length ? { errors } : {}),
    };
  } catch (e) {  } catch (e) {
    return {
      ok: false,
      upserted: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : "GCal sync error",
    };
  }
}
