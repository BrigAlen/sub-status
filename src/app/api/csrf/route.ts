import { NextResponse } from "next/server";
import { ensureCsrfCookie } from "@/lib/csrf";
import { requireAuth } from "@/lib/session";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    // CSRF token available after auth (or open-dev)
    try {
      await requireAuth();
    } catch {
      // still issue token for login page flows that need it later
    }
    const token = await ensureCsrfCookie();
    return NextResponse.json({ csrfToken: token });
  } catch (e) {
    return handleApiError(e);
  }
}
