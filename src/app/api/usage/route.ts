import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { listLatestUsage } from "@/lib/subscriptions";
import { handleApiError, jsonError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const ip = clientIp(req);
    const rl = rateLimit("api:" + ip, 120, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);
    const data = await listLatestUsage();
    return NextResponse.json({ data });
  } catch (e) {
    return handleApiError(e);
  }
}
