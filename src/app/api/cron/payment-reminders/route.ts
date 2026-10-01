import { NextResponse } from "next/server";
import { sendTomorrowPaymentPushes } from "@/lib/web-push";
import { writeAudit } from "@/lib/audit";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Daily cron: Web Push «завтра оплата».
 * Authorization: Bearer $CRON_SECRET
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError("CRON_SECRET не задан", 503);
  const auth = req.headers.get("authorization") || "";
  if (auth !== "Bearer " + secret) return jsonError("Unauthorized", 401);

  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await sendTomorrowPaymentPushes({ force });
  await writeAudit({
    action: "push_cron_reminders",
    meta: result,
  });
  return NextResponse.json({ data: result });
}

export async function GET(req: Request) {
  return POST(req);
}
