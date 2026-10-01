import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { handleApiError, jsonError } from "@/lib/api";
import { syncPaymentReminders } from "@/lib/google-calendar";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("gcal-sync:" + ip, 10, 60_000);
    if (!rl.ok) return jsonError("Слишком частая синхронизация", 429);

    const result = await syncPaymentReminders();
    await writeAudit({
      action: "gcal_sync",
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: { ok: result.ok, upserted: result.upserted, skipped: result.skipped },
    });
    return NextResponse.json({ data: result }, { status: result.ok ? 200 : 502 });
  } catch (e) {
    return handleApiError(e);
  }
}
