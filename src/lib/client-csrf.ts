"use client";

export async function fetchCsrf(): Promise<string> {
  const res = await fetch("/api/csrf", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Не удалось получить CSRF");
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

export async function apiMutate(
  url: string,
  method: string,
  body?: unknown
): Promise<Response> {
  const csrf = await fetchCsrf();
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
