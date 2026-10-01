import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { safeEqual } from "./crypto";

export const CSRF_COOKIE = "sub_status_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export async function ensureCsrfCookie(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  if (existing && existing.length >= 32) return existing;
  const token = generateCsrfToken();
  jar.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}

export async function assertCsrf(req: Request): Promise<void> {
  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new CsrfError();
  }
}

export class CsrfError extends Error {
  status = 403;
  constructor() {
    super("\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 CSRF-\u0442\u043e\u043a\u0435\u043d");
  }
}
