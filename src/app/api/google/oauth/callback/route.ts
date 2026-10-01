import { NextResponse } from "next/server";
import { getSession, requireAuth } from "@/lib/session";
import { handleApiError, jsonError } from "@/lib/api";
import { exchangeGoogleCode, resolveOAuthAppBase, saveGoogleTokens, setGcalSettings } from "@/lib/google-calendar";
import { writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

function isLocalhostBase(base: string): boolean {
  try {
    const host = new URL(base).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(base);
  }
}

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const err = url.searchParams.get("error");

    const session = await getSession();
    // Prefer session base from OAuth start; never keep Render-internal localhost.
    let publicBase = session.gcalOAuthRedirectBase || resolveOAuthAppBase(req);
    if (isLocalhostBase(publicBase)) {
      publicBase = resolveOAuthAppBase(req);
    }

    if (err) {
      delete session.gcalOAuthState;
      delete session.gcalOAuthRedirectBase;
      await session.save();
      return NextResponse.redirect(
        new URL("/settings?gcal=error&reason=" + encodeURIComponent(err), publicBase)
      );
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return jsonError("Нет code/state", 400);

    const expected = session.gcalOAuthState;
    if (!expected || expected !== state) return jsonError("Неверный OAuth state", 400);
    delete session.gcalOAuthState;
    delete session.gcalOAuthRedirectBase;
    await session.save();

    const tokens = await exchangeGoogleCode(code, publicBase);
    await saveGoogleTokens(tokens);
    await setGcalSettings({ enabled: true });

    await writeAudit({
      action: "gcal_oauth_connected",
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.redirect(new URL("/settings?gcal=connected", publicBase));
  } catch (e) {
    return handleApiError(e);
  }
}
