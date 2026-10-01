import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { getSession, verifyAppPassword } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit("login:" + ip, 10, 15 * 60 * 1000);
    if (!rl.ok) {
      return jsonError("Слишком много попыток. Подождите.", 429);
    }

    const body = loginSchema.parse(await req.json());
    if (!verifyAppPassword(body.password)) {
      await writeAudit({
        action: "login_failed",
        ip,
        userAgent: req.headers.get("user-agent"),
      });
      return jsonError("Неверный пароль", 401);
    }

    const session = await getSession();
    session.authenticated = true;
    session.loginAt = new Date().toISOString();
    await session.save();

    await writeAudit({
      action: "login_success",
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
