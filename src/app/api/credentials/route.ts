import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { providerCredentialSchema } from "@/lib/validation";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/db";
import { providerCredentials } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api";
import { ensureProviderSubscription } from "@/lib/ensure-subscriptions";
import { parseClaudeSecret } from "@/providers/claude";
import { parseCursorSecret } from "@/providers/cursor";

/** Store encrypted provider secret. Never returns plaintext. Upserts by provider+label. */
export async function POST(req: Request) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("mutate:" + ip, 20, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);

    const parsed = providerCredentialSchema.parse(await req.json());
    const db = getDb();
    if (!db) return jsonError("DATABASE_URL требуется для хранения секретов", 503);

    try {
      if (parsed.provider === "claude") parseClaudeSecret(parsed.secret);
      else parseCursorSecret(parsed.secret);
    } catch (e) {
      return jsonError(
        e instanceof Error ? e.message : "Неверный формат секрета",
        400
      );
    }

    const sub = await ensureProviderSubscription(parsed.provider);
    const subscriptionId = parsed.subscriptionId || sub.id;

    const enc = encryptSecret(parsed.secret);
    const existing = await db
      .select({ id: providerCredentials.id })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.provider, parsed.provider),
          eq(providerCredentials.label, parsed.label)
        )
      )
      .limit(1);

    let row: {
      id: string;
      subscriptionId: string;
      provider: string;
      label: string;
      createdAt: Date;
      updatedAt: Date;
    };

    if (existing[0]) {
      const updated = await db
        .update(providerCredentials)
        .set({
          subscriptionId,
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          updatedAt: new Date(),
        })
        .where(eq(providerCredentials.id, existing[0].id))
        .returning({
          id: providerCredentials.id,
          subscriptionId: providerCredentials.subscriptionId,
          provider: providerCredentials.provider,
          label: providerCredentials.label,
          createdAt: providerCredentials.createdAt,
          updatedAt: providerCredentials.updatedAt,
        });
      row = updated[0]!;
    } else {
      const inserted = await db
        .insert(providerCredentials)
        .values({
          subscriptionId,
          provider: parsed.provider,
          label: parsed.label,
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
        })
        .returning({
          id: providerCredentials.id,
          subscriptionId: providerCredentials.subscriptionId,
          provider: providerCredentials.provider,
          label: providerCredentials.label,
          createdAt: providerCredentials.createdAt,
          updatedAt: providerCredentials.updatedAt,
        });
      row = inserted[0]!;
    }

    await writeAudit({
      action: "credential_store",
      entityType: "provider_credential",
      entityId: row.id,
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: { provider: parsed.provider, label: parsed.label },
    });

    return NextResponse.json(
      { data: { ...row, configured: true } },
      { status: existing[0] ? 200 : 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: Request) {
  try {
    await requireAuth();
    const db = getDb();
    if (!db) return NextResponse.json({ data: [] });
    const url = new URL(req.url);
    const subId = url.searchParams.get("subscriptionId");
    const provider = url.searchParams.get("provider");

    const base = db
      .select({
        id: providerCredentials.id,
        subscriptionId: providerCredentials.subscriptionId,
        provider: providerCredentials.provider,
        label: providerCredentials.label,
        createdAt: providerCredentials.createdAt,
        updatedAt: providerCredentials.updatedAt,
      })
      .from(providerCredentials);

    let rows;
    if (subId) {
      rows = await base.where(eq(providerCredentials.subscriptionId, subId));
    } else if (provider) {
      rows = await base.where(eq(providerCredentials.provider, provider));
    } else {
      rows = await base;
    }

    return NextResponse.json({
      data: rows.map((r) => ({ ...r, configured: true })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
