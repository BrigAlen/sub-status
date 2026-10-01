import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { pushSubscribeSchema } from "@/lib/validation";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("mutate:" + ip, 20, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);

    const parsed = pushSubscribeSchema.parse(await req.json());
    const db = getDb();
    if (!db) {
      return NextResponse.json({
        ok: true,
        stub: true,
        message: "Push сохранён локально (нет DATABASE_URL)",
      });
    }

    const existing = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, parsed.endpoint))
      .limit(1);

    if (existing[0]) {
      await db
        .update(pushSubscriptions)
        .set({
          keysP256dh: parsed.keys.p256dh,
          keysAuth: parsed.keys.auth,
          userAgent: req.headers.get("user-agent"),
        })
        .where(eq(pushSubscriptions.id, existing[0].id));
    } else {
      await db.insert(pushSubscriptions).values({
        endpoint: parsed.endpoint,
        keysP256dh: parsed.keys.p256dh,
        keysAuth: parsed.keys.auth,
        userAgent: req.headers.get("user-agent"),
      });
    }

    await writeAudit({
      action: "push_subscribe",
      entityType: "push_subscription",
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
