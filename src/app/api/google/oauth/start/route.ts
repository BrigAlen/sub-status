import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { handleApiError, jsonError } from "@/lib/api";
import { getGoogleAuthUrl, googleOAuthConfigured } from "@/lib/google-calendar";
import { randomBytes } from "crypto";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const ip = clientIp(req);
    const rl = rateLimit("gcal-oauth:" + ip, 10, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);
    if (!googleOAuthConfigured()) {
      return jsonError(
        "Задайте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в env (Render)",
        503
      );
    }
    const state = randomBytes(16).toString("hex");
    const session = await getSession();
    (session as { gcalOAuthState?: string }).gcalOAuthState = state;
    await session.save();
    const url = getGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    return handleApiError(e);
  }
}
