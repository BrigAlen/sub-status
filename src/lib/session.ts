import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { safeEqual } from "./crypto";

export const SESSION_COOKIE = "sub_status_session";

export type SessionData = {
  authenticated: boolean;
  loginAt?: string;
  gcalOAuthState?: string;
  /** PKCE verifier for pending Claude OAuth */
  claudeOAuthVerifier?: string;
  claudeOAuthState?: string;
};

function isOpenDev(): boolean {
  return (
    process.env.ALLOW_MOCK_DATA === "true" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.APP_PASSWORD
  );
}

function sessionOptions(): SessionOptions {
  const password =
    process.env.AUTH_SECRET ||
    "dev-only-auth-secret-change-me-32chars!!";
  if (password.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }
  return {
    cookieName: SESSION_COOKIE,
    password,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export async function requireAuth(): Promise<SessionData> {
  if (isOpenDev()) {
    return { authenticated: true, loginAt: new Date().toISOString() };
  }
  const session = await getSession();
  if (!session.authenticated) {
    throw new AuthError();
  }
  return {
    authenticated: true,
    loginAt: session.loginAt,
  };
}

export function verifyAppPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD || "";
  if (!expected) {
    return isOpenDev();
  }
  return safeEqual(input, expected);
}

export class AuthError extends Error {
  status = 401;
  constructor() {
    super("Требуется авторизация");
  }
}