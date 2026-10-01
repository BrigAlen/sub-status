import { NextResponse } from "next/server";
import { getSession, requireAuth } from "@/lib/session";
import { handleApiError, jsonError } from "@/lib/api";
import { exchangeGoogleCode, resolveOAuthAppBase, saveGoogleTokens, setGcalSettings } from "@/lib/google-calendar";
import { writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const err = url.searchParams.get("error");
    if (err) {
      return NextResponse.redirect(
        new URL("/settings?gcal=error&reason=" + encodeURIComponent(err), url.origin)
      );
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return jsonError("Нет code/state", 400);

    const session = await getSession();
    const expected = session.gcalOAuthState;
    if (!expected || expected !== state) return jsonError("Неверный OAuth state", 400);
    const redirectBase =
      session.gcalOAuthRedirectBase || resolveOAuthAppBase(req);
    delete session.gcalOAuthState;
    delete session.gcalOAuthRedirectBase;
    await session.save();

    const tokens = await exchangeGoogleCode(code, redirectBase);
    await saveGoogleTokens(tokens);
    await setGcalSettings({ enabled: true });

    await writeAudit({
      action: "gcal_oauth_connected",
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.redirect(new URL("/settings?gcal=connected", url.origin));
  } catch (e) {
    return handleApiError(e);
  }
}
