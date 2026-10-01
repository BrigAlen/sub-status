"use client";

import { useEffect, useState } from "react";
import { apiMutate } from "@/lib/client-csrf";
import { ProviderIcon } from "@/components/ProviderIcon";

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

  const [claudeCode, setClaudeCode] = useState("");
  const [showClaudeAdvanced, setShowClaudeAdvanced] = useState(false);
  const [claudeAccess, setClaudeAccess] = useState("");
  const [claudeRefresh, setClaudeRefresh] = useState("");

  const [cursorCookie, setCursorCookie] = useState("");
  const [saving, setSaving] = useState<
    "claude" | "claude-oauth" | "cursor" | null
  >(null);

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
    const q = new URLSearchParams(window.location.search);
    if (q.get("claude") === "awaiting") {
      setMsg(
        "Войди в Claude, скопируй код со страницы Anthropic и вставь ниже."
      );
    }
  }, []);

  function hasProvider(p: string) {
    return creds.some((c) => c.provider === p);
  }

  function updatedAt(p: string) {
    const c = creds.find((x) => x.provider === p);
    if (!c?.updatedAt) return null;
    return new Date(c.updatedAt).toLocaleString("ru-RU");
  }

  async function completeClaudeOAuth(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving("claude-oauth");
    try {
      const res = await apiMutate("/api/claude/oauth/complete", "POST", {
        code: claudeCode.trim(),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Ошибка OAuth");
      setClaudeCode("");
      setMsg("Claude подключён через OAuth. Токены зашифрованы на сервере.");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка");
    } finally {
      setSaving(null);
    }
  }

  async function saveClaudeManual(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving("claude");
    try {
      if (!claudeAccess.trim()) throw new Error("Нужен accessToken");
      const secret = JSON.stringify({
        accessToken: claudeAccess.trim(),
        refreshToken: claudeRefresh.trim(),
      });
      const res = await apiMutate("/api/credentials", "POST", {
        provider: "claude",
        label: "default",
        secret,
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Ошибка сохранения");
      setClaudeAccess("");
      setClaudeRefresh("");
      setMsg("Claude: токены сохранены (зашифрованы).");
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
      if (!cursorCookie.trim()) {
        throw new Error("Вставь значение cookie WorkosCursorSessionToken");
      }
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
        "Cursor: сессия сохранена (зашифрована). Когда cookie истечёт — обнови здесь."
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
      {loading ? <p className="text-sm text-zinc-500">Загрузка…</p> : null}

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
          <div className="flex items-start gap-3">
            <ProviderIcon provider="claude" size={36} />
            <div>
              <h2 className="text-lg font-semibold">Claude</h2>
              <p className="text-sm text-zinc-500">
                Вход через OAuth (как Claude Code). Токены только в
                зашифрованном виде на сервере.
              </p>
            </div>
          </div>
          <span
            className={
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
              (hasProvider("claude")
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            {hasProvider("claude") ? "Подключён" : "Не подключён"}
          </span>
        </div>
        {updatedAt("claude") ? (
          <p className="mb-3 text-xs text-zinc-400">
            Обновлено: {updatedAt("claude")}
          </p>
        ) : null}

        <div className="space-y-3">
          <a
            href="/api/claude/oauth/start"
            className="inline-flex items-center justify-center rounded-lg bg-[#D97757] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
          >
            {hasProvider("claude")
              ? "Переподключить Claude"
              : "Подключить Claude"}
          </a>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-500">
            <li>Нажми кнопку — откроется вход Claude.</li>
            <li>
              После входа на странице Anthropic появится код (иногда вида{" "}
              <code className="text-xs">код#state</code>).
            </li>
            <li>Скопируй его и вставь ниже, затем сохрани.</li>
          </ol>

          <form onSubmit={completeClaudeOAuth} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Код авторизации
              </label>
              <textarea
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                rows={3}
                value={claudeCode}
                onChange={(e) => setClaudeCode(e.target.value)}
                placeholder="Вставь код со страницы Anthropic"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={saving === "claude-oauth" || !claudeCode.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving === "claude-oauth" ? "Сохранение…" : "Завершить OAuth"}
            </button>
          </form>

          <button
            type="button"
            className="text-sm text-zinc-500 underline"
            onClick={() => setShowClaudeAdvanced((v) => !v)}
          >
            {showClaudeAdvanced
              ? "Скрыть ручной ввод токенов"
              : "Дополнительно: вставить токены вручную"}
          </button>

          {showClaudeAdvanced ? (
            <form onSubmit={saveClaudeManual} className="space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  accessToken
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={claudeAccess}
                  onChange={(e) => setClaudeAccess(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  refreshToken
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={claudeRefresh}
                  onChange={(e) => setClaudeRefresh(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                disabled={saving === "claude"}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
              >
                {saving === "claude" ? "Сохранение…" : "Сохранить токены"}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ProviderIcon provider="cursor" size={36} />
            <div>
              <h2 className="text-lg font-semibold">Cursor</h2>
              <p className="text-sm text-zinc-500">
                Публичного OAuth для лимитов нет — нужна сессия браузера
                (cookie). Это не пароль приложения.
              </p>
            </div>
          </div>
          <span
            className={
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
              (hasProvider("cursor")
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            {hasProvider("cursor") ? "Сессия есть" : "Нет сессии"}
          </span>
        </div>
        {updatedAt("cursor") ? (
          <p className="mb-3 text-xs text-zinc-400">
            Обновлено: {updatedAt("cursor")}
          </p>
        ) : null}

        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-zinc-500">
          <li>
            Открой{" "}
            <a
              className="underline"
              href="https://cursor.com/settings"
              target="_blank"
              rel="noreferrer"
            >
              cursor.com
            </a>{" "}
            в том же браузере, где ты залогинен.
          </li>
          <li>
            DevTools → Application → Cookies → скопируй значение{" "}
            <code className="text-xs">WorkosCursorSessionToken</code>.
          </li>
          <li>Вставь ниже и сохрани. Повтори, когда лимиты перестанут
            обновляться.
          </li>
        </ol>

        <form onSubmit={saveCursor} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Cookie сессии
            </label>
            <textarea
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
              rows={3}
              value={cursorCookie}
              onChange={(e) => setCursorCookie(e.target.value)}
              placeholder="WorkosCursorSessionToken=… или только значение"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={saving === "cursor"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving === "cursor" ? "Сохранение…" : "Сохранить сессию Cursor"}
          </button>
        </form>
      </section>
    </div>
  );
}