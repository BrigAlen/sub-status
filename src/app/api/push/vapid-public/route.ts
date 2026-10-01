import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { handleApiError } from "@/lib/api";

/** Only public VAPID key — never expose private key to client */
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({
      publicKey: process.env.VAPID_PUBLIC_KEY || "",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
