import { NextResponse } from "next/server";
import { AuthError } from "./session";
import { CsrfError } from "./csrf";
import { ZodError } from "zod";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) return jsonError(err.message, err.status);
  if (err instanceof CsrfError) return jsonError(err.message, err.status);
  if (err instanceof ZodError) {
    return jsonError("\u041e\u0448\u0438\u0431\u043a\u0430 \u0432\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u0438: " + err.issues[0]?.message, 400);
  }
  console.error(err);
  return jsonError("\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u043e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430", 500);
}
