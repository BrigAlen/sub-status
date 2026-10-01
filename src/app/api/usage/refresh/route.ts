import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getDb } from "@/db";
import { providerCredentials, usageSnapshots } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api";
import { ensureProviderSubscription } from "@/lib/ensure-subscriptions";
import { listLatestUsage } from "@/lib/subscriptions";
import {
  fetchClaudeUsage,
  parseClaudeSecret,
  serializeClaudeTokens,
} from "@/providers/claude";
import { fetchCursorUsage, parseCursorSecret } from "@/providers/cursor";
import { syncPaymentReminders } from "@/lib/google-calendar";

type ProviderReport = {
  provider: "cursor" | "claude";
  ok: boolean;
  error?: string;
  snapshots?: number;
};

async function loadCredential(provider: "cursor" | "claude") {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(providerCredentials)
    .where(eq(providerCredentials.provider, provider))
    .limit(1);
  return rows[0] ?? null;
}

async function insertWindows(
  subscriptionId: string,
  source: string,
  windows: {
    label: string;
    usedPercent: number | null;
    remainingText: string | null;
    resetsAt: Date | null;
  }[],
  raw: unknown
) {
  const db = getDb();
  if (!db || windows.length === 0) return 0;
  const values = windows.map((w) => ({
    subscriptionId,
    source,
    label: w.label,
    usedPercent:
      w.usedPercent != null
        ? (Math.round(w.usedPercent * 100) / 100).toFixed(2)
        : null,
    remainingText: w.remainingText,
    resetsAt: w.resetsAt,
    rawJson: raw as Record<string, unknown> | null,
  }));
  await db.insert(usageSnapshots).values(values);
  return values.length;
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("usage-refresh:" + ip, 10, 60_000);
    if (!rl.ok) return jsonError("Слишком частые обновления. Подождите.", 429);

    const db = getDb();
    if (!db) return jsonError("DATABASE_URL требуется для обновления лимитов", 503);

    const reports: ProviderReport[] = [];

    // --- Claude ---
    try {
      const cred = await loadCredential("claude");
      if (!cred) {
        reports.push({
          provider: "claude",
          ok: false,
          error: "Нет сохранённых учётных данных Claude",
        });
      } else {
        const sub = await ensureProviderSubscription("claude");
        const plaintext = decryptSecret({
          ciphertext: cred.ciphertext,
          iv: cred.iv,
          authTag: cred.authTag,
        });
        const tokens = parseClaudeSecret(plaintext);
        const result = await fetchClaudeUsage(tokens);

        if (result.updatedTokens) {
          const enc = encryptSecret(serializeClaudeTokens(result.updatedTokens));
          await db
            .update(providerCredentials)
            .set({
              ciphertext: enc.ciphertext,
              iv: enc.iv,
              authTag: enc.authTag,
              updatedAt: new Date(),
              subscriptionId: sub.id,
            })
            .where(eq(providerCredentials.id, cred.id));
        }

        if (result.error && result.windows.length === 0) {
          reports.push({
            provider: "claude",
            ok: false,
            error: result.error,
          });
        } else {
          const n = await insertWindows(
            sub.id,
            "claude_oauth",
            result.windows,
            result.raw
          );
          reports.push({
            provider: "claude",
            ok: true,
            snapshots: n,
            error: result.error,
          });
        }
      }
    } catch (e) {
      reports.push({
        provider: "claude",
        ok: false,
        error: e instanceof Error ? e.message : "Claude: сбой",
      });
    }

    // --- Cursor ---
    try {
      const cred = await loadCredential("cursor");
      if (!cred) {
        reports.push({
          provider: "cursor",
          ok: false,
          error: "Нет сохранённых учётных данных Cursor",
        });
      } else {
        const sub = await ensureProviderSubscription("cursor");
        const plaintext = decryptSecret({
          ciphertext: cred.ciphertext,
          iv: cred.iv,
          authTag: cred.authTag,
        });
        const secret = parseCursorSecret(plaintext);
        const result = await fetchCursorUsage(secret);

        if (result.error && result.windows.length === 0) {
          reports.push({
            provider: "cursor",
            ok: false,
            error: result.error,
          });
        } else {
          const n = await insertWindows(
            sub.id,
            "cursor_cookie",
            result.windows,
            result.raw
          );
          reports.push({
            provider: "cursor",
            ok: true,
            snapshots: n,
            error: result.error,
          });
        }
      }
    } catch (e) {
      reports.push({
        provider: "cursor",
        ok: false,
        error: e instanceof Error ? e.message : "Cursor: сбой",
      });
    }

    await writeAudit({
      action: "usage_refresh",
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: {
        results: reports.map((r) => ({
          provider: r.provider,
          ok: r.ok,
          error: r.error ?? null,
        })),
      },
    });

    const latest = await listLatestUsage();
    let calendar = null;
    try {
      calendar = await syncPaymentReminders();
    } catch {
      calendar = { ok: false, upserted: 0, skipped: 0, error: "GCal sync failed" };
    }
    return NextResponse.json({ data: { reports, latest, calendar } });
  } catch (e) {
    return handleApiError(e);
  }
}
