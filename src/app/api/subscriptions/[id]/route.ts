import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { subscriptionUpdateSchema } from "@/lib/validation";
import {
  getSubscription,
  updateSubscription,
  deleteSubscription,
} from "@/lib/subscriptions";
import { writeAudit } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    const row = await getSubscription(id);
    if (!row) return jsonError("Не найдено", 404);
    return NextResponse.json({ data: row });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("mutate:" + ip, 30, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);
    const { id } = await ctx.params;
    const parsed = subscriptionUpdateSchema.parse(await req.json());
    const row = await updateSubscription(id, {
      ...parsed,
      amountCents: parsed.amountCents === undefined ? undefined : parsed.amountCents ?? null,
      nextBillingAt:
        parsed.nextBillingAt === undefined ? undefined : parsed.nextBillingAt ?? null,
      notes: parsed.notes === undefined ? undefined : parsed.notes ?? null,
    });
    if (!row) return jsonError("Не найдено", 404);
    await writeAudit({
      action: "subscription_update",
      entityType: "subscription",
      entityId: id,
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: parsed,
    });
    return NextResponse.json({ data: row });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("mutate:" + ip, 30, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);
    const { id } = await ctx.params;
    const ok = await deleteSubscription(id);
    if (!ok) return jsonError("Не найдено", 404);
    await writeAudit({
      action: "subscription_delete",
      entityType: "subscription",
      entityId: id,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
