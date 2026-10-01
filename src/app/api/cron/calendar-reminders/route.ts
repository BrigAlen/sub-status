import { NextResponse } from "next/server";
import { syncPaymentReminders } from "@/lib/google-calendar";
import { writeAudit } from "@/lib/audit";
import { jsonError } from "@/lib/api";

/**
 * Cron-friendly endpoint. Authorize with header:
 *   Authorization: Bearer $CRON_SECRET
 * Schedule daily on Render Cron Jobs.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError("CRON_SECRET не задан", 503);
  const auth = req.headers.get("authorization") || "";
  if (auth !== "Bearer " + secret) return jsonError("Unauthorized", 401);

  const result = await syncPaymentReminders();
  await writeAudit({
    action: "gcal_cron_sync",
    meta: { ok: result.ok, upserted: result.upserted, skipped: result.skipped },
  });
  return NextResponse.json({ data: result });
}

export async function GET(req: Request) {
  return POST(req);
}
