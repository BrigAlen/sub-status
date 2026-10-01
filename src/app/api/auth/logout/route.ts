import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    await assertCsrf(req);
    const session = await getSession();
    session.destroy();
    await writeAudit({
      action: "logout",
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
