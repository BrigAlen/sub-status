"use client";

import { useEffect, useState } from "react";
import { apiMutate } from "@/lib/client-csrf";

type CredMeta = {
  id: string;
  provider: string;
  label: string;
  updatedAt?: string;
  configured?: boolean;
};

export function CredentialsForms() {
  const [creds, setCreds] = useState<CredMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [claudeAccess, setClaudeAccess] = useState("");
  const [claudeRefresh, setClaudeRefresh] = useState("");
  const [claudeJson, setClaudeJson] = useState("");
  const [useClaudeJson, setUseClaudeJson] = useState(false);

  const [cursorCookie, setCursorCookie] = useState("");
  const [saving, setSaving] = useState<"claude" | "cursor" | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials", { credentials: "same-origin" });
      const data = (await res.json()) as { data?: CredMeta[] };
      setCreds(data.data ?? []);
    } catch {
      setCreds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function hasProvider(p: string) {
    return creds.some((c) => c.provider === p);
  }

  function updatedAt(p: string) {
    const c = creds.find((x) => x.provider === p);
    if (!c?.updatedAt) return null;
    return new Date(c.updatedAt).toLocaleString("ru-RU");
  }

  async function saveClaude(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving("claude");
    try {
      let secret: string;
      if (useClaudeJson) {
        secret = claudeJson.trim();
        JSON.parse(secret);
      } else {
        if (!claudeAccess.trim()) throw new Error("Укажите accessToken");
        secret = JSON.stringify({
          accessToken: claudeAccess.trim(),
          refreshToken: claudeRefresh.trim(),
        });
      }
      const res = await apiMutate("/api/credentials", "POST", {
        provider: "claude",
        label: "default",
        secret,
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Ошибка сохранения");
      setClaudeAccess("");
      setClaudeRefresh("");
      setClaudeJson("");
      setMsg("Claude: секрет сохранён (зашифрован). Значение больше не показывается.");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка");
    } finally {
      setSaving(null);
    }
  }

  async function saveCursor(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving("cursor");
    try {
      if (!cursorCookie.trim()) throw new Error("Вставьте WorkosCursorSessionToken");
      const secret = JSON.stringify({ sessionToken: cursorCookie.trim() });
      const res = await apiMutate("/api/credentials", "POST", {
        provider: "cursor",
        label: "default",
        secret,
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Ошибка сохранения");
      setCursorCookie("");
      setMsg(
        "Cursor: cookie сохранён (зашифрован). При истечении сессии вставьте заново."
      );
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-8">
      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : null}

      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </p>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Claude OAuth</h2>
            <p className="text-sm text-zinc-500">
              accessToken и refreshToken. Хранятся только в зашифрованном виде
              (AES-GCM). Текст обратно не возвращается.
            </p>
          </div>
          <span
            className={
              "rounded-full px-2.5 py-1 text-xs font-medium " +
              (hasProvider("claude")
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            {hasProvider("claude") ? "Настроено" : "Не задано"}
          </span>
        </div>
        {updatedAt("claude") ? (
          <p className="mb-3 text-xs text-zinc-400">
            Обновлено: {updatedAt("claude")}
          </p>
        ) : null}

        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useClaudeJson}
            onChange={(e) => setUseClaudeJson(e.target.checked)}
          />
          Вставить JSON целиком
        </label>

        <form onSubmit={saveClaude} className="space-y-3">
          {useClaudeJson ? (
            <div>
              <label className="mb-1 block text-sm font-medium">
                JSON (accessToken + refreshToken)
              </label>
              <textarea
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                rows={4}
                value={claudeJson}
                onChange={(e) => setClaudeJson(e.target.value)}
                placeholder='{"accessToken":"...","refreshToken":"..."}'
                autoComplete="off"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">accessToken</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={claudeAccess}
                  onChange={(e) => setClaudeAccess(e.target.value)}
                  placeholder="Новый access token"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">refreshToken</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={claudeRefresh}
                  onChange={(e) => setClaudeRefresh(e.target.value)}
                  placeholder="Refresh token (для обновления при 401)"
                  autoComplete="off"
                />
              </div>
            </>
          )}
          <button
            type="submit"
            disabled={saving === "claude"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving === "claude" ? "Сохранение…" : "Сохранить Claude"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cursor session cookie</h2>
            <p className="text-sm text-zinc-500">
              Значение cookie <code className="text-xs">WorkosCursorSessionToken</code> из
              браузера (DevTools → Application → Cookies → cursor.com). Cookie истекает —
              при ошибке авторизации вставьте заново.
            </p>
          </div>
          <span
            className={
              "rounded-full px-2.5 py-1 text-xs font-medium " +
              (hasProvider("cursor")
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            {hasProvider("cursor") ? "Настроено" : "Не задано"}
          </span>
        </div>
        {updatedAt("cursor") ? (
          <p className="mb-3 text-xs text-zinc-400">
            Обновлено: {updatedAt("cursor")}
          </p>
        ) : null}

        <form onSubmit={saveCursor} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              WorkosCursorSessionToken
            </label>
            <textarea
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
              rows={3}
              value={cursorCookie}
              onChange={(e) => setCursorCookie(e.target.value)}
              placeholder="Вставьте значение cookie (не логируется, не показывается обратно)"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={saving === "cursor"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving === "cursor" ? "Сохранение…" : "Сохранить Cursor"}
          </button>
        </form>
      </section>
    </div>
  );
}
