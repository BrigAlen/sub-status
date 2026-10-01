import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth, getSession } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { handleApiError, jsonError } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/db";
import { providerCredentials } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { ensureProviderSubscription } from "@/lib/ensure-subscriptions";
import {
  exchangeClaudeAuthCode,
  parseClaudeAuthCode,
} from "@/lib/claude-oauth";
import { serializeClaudeTokens } from "@/providers/claude";

export async function POST(req: Request) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("claude-oauth-complete:" + ip, 10, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);

    const db = getDb();
    if (!db) return jsonError("DATABASE_URL нужен для хранения секретов", 503);

    const body = (await req.json()) as { code?: string };
    const session = await getSession();
    const verifier = session.claudeOAuthVerifier;
    const expectedState = session.claudeOAuthState;
    if (!verifier || !expectedState) {
      return jsonError(
        "Сначала нажми «Подключить Claude», затем вставь код с страницы Anthropic",
        400
      );
    }

    let parsed;
    try {
      parsed = parseClaudeAuthCode(String(body.code || ""));
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Неверный код", 400);
    }

    if (parsed.state && parsed.state !== expectedState) {
      return jsonError("State не совпадает — начни подключение заново", 400);
    }

    const tokens = await exchangeClaudeAuthCode({
      code: parsed.code,
      codeVerifier: verifier,
      state: expectedState,
    });

    const secret = serializeClaudeTokens(tokens);
    const enc = encryptSecret(secret);
    const sub = await ensureProviderSubscription("claude");

    const existing = await db
      .select({ id: providerCredentials.id })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.provider, "claude"),
          eq(providerCredentials.label, "default")
        )
      )
      .limit(1);

    let id: string;
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
      id = existing[0].id;
    } else {
      const inserted = await db
        .insert(providerCredentials)
        .values({
          subscriptionId: sub.id,
          provider: "claude",
          label: "default",
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
        })
        .returning({ id: providerCredentials.id });
      id = inserted[0]!.id;
    }

    delete session.claudeOAuthVerifier;
    delete session.claudeOAuthState;
    await session.save();

    await writeAudit({
      action: "credential_store",
      entityType: "provider_credential",
      entityId: id,
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: { provider: "claude", label: "default", via: "oauth" },
    });

    return NextResponse.json({ data: { configured: true, id } });
  } catch (e) {
    return handleApiError(e);
  }
}