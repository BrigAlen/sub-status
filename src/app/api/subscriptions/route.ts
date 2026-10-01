import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { subscriptionCreateSchema } from "@/lib/validation";
import {
  listSubscriptions,
  createSubscription,
} from "@/lib/subscriptions";
import { writeAudit } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const ip = clientIp(req);
    const rl = rateLimit("api:" + ip, 120, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);
    const rows = await listSubscriptions();
    return NextResponse.json({ data: rows });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("mutate:" + ip, 30, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);

    const parsed = subscriptionCreateSchema.parse(await req.json());
    const row = await createSubscription({
      name: parsed.name,
      provider: parsed.provider,
      kind: parsed.kind,
      amountCents: parsed.amountCents ?? null,
      currency: parsed.currency,
      billingPeriod: parsed.billingPeriod,
      nextBillingAt: parsed.nextBillingAt ?? null,
      notes: parsed.notes ?? null,
      isActive: parsed.isActive ?? true,
      calendarRemind: parsed.calendarRemind ?? true,
    });

    await writeAudit({
      action: "subscription_create",
      entityType: "subscription",
      entityId: row.id,
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: { name: row.name, provider: row.provider },
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
