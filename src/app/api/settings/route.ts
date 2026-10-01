import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/session";
import { assertCsrf } from "@/lib/csrf";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { handleApiError, jsonError } from "@/lib/api";
import {
  getGcalSettings,
  setGcalSettings,
  googleCalendarConnected,
  googleOAuthConfigured,
} from "@/lib/google-calendar";

const patchSchema = z.object({
  googleCalendar: z
    .object({
      enabled: z.boolean().optional(),
      remindOn: z.enum(["day_of", "day_before"]).optional(),
      calendarId: z.string().trim().min(1).max(200).optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    await requireAuth();
    const gcal = await getGcalSettings();
    return NextResponse.json({
      data: {
        googleCalendar: {
          ...gcal,
          connected: await googleCalendarConnected(),
          oauthConfigured: googleOAuthConfigured(),
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAuth();
    await assertCsrf(req);
    const ip = clientIp(req);
    const rl = rateLimit("settings:" + ip, 30, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);

    const body = patchSchema.parse(await req.json());
    let gcal = await getGcalSettings();
    if (body.googleCalendar) {
      gcal = await setGcalSettings(body.googleCalendar);
    }
    return NextResponse.json({
      data: {
        googleCalendar: {
          ...gcal,
          connected: await googleCalendarConnected(),
          oauthConfigured: googleOAuthConfigured(),
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
