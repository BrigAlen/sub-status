import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { providerCredentialSchema } from "@/lib/validation";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/db";
import { providerCredentials } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api";

/** Store encrypted provider secret. Never returns plaintext. */
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

    const enc = encryptSecret(parsed.secret);
    const rows = await db
      .insert(providerCredentials)
      .values({
        subscriptionId: parsed.subscriptionId,
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
      });

    await writeAudit({
      action: "credential_store",
      entityType: "provider_credential",
      entityId: rows[0]!.id,
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: { provider: parsed.provider, label: parsed.label },
    });

    return NextResponse.json({ data: rows[0] }, { status: 201 });
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
    const q = db
      .select({
        id: providerCredentials.id,
        subscriptionId: providerCredentials.subscriptionId,
        provider: providerCredentials.provider,
        label: providerCredentials.label,
        createdAt: providerCredentials.createdAt,
        updatedAt: providerCredentials.updatedAt,
      })
      .from(providerCredentials);
    const rows = subId
      ? await q.where(eq(providerCredentials.subscriptionId, subId))
      : await q;
    return NextResponse.json({ data: rows });
  } catch (e) {
    return handleApiError(e);
  }
}
