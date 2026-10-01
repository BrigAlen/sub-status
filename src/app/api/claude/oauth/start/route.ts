import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { handleApiError, jsonError } from "@/lib/api";
import { buildClaudeAuthUrl, generateClaudePkce } from "@/lib/claude-oauth";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const ip = clientIp(req);
    const rl = rateLimit("claude-oauth:" + ip, 10, 60_000);
    if (!rl.ok) return jsonError("Rate limit", 429);

    const pkce = generateClaudePkce();
    const session = await getSession();
    session.claudeOAuthVerifier = pkce.verifier;
    session.claudeOAuthState = pkce.state;
    await session.save();

    return NextResponse.redirect(buildClaudeAuthUrl(pkce));
  } catch (e) {
    return handleApiError(e);
  }
}