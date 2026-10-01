"use client";

import { useEffect, useState } from "react";
import { apiMutate } from "@/lib/client-csrf";
import { ProviderIcon } from "@/components/ProviderIcon";

type GcalState = {
  enabled: boolean;
  remindOn: "day_of" | "day_before";
  calendarId: string;
  connected: boolean;
  oauthConfigured: boolean;
};

export function GoogleCalendarSettings() {
  const [gcal, setGcal] = useState<GcalState | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/settings", { credentials: "same-origin" });
      const body = (await res.json()) as { data?: { googleCalendar: GcalState } };
      setGcal(body.data?.googleCalendar ?? null);
    } catch {
      setGcal(null);
    }
  }

  useEffect(() => {
    void load();
    const q = new URLSearchParams(window.location.search);
    if (q.get("gcal") === "connected") setMsg("Google Calendar подключён.");
    if (q.get("gcal") === "error")
      setErr("OAuth ошибка: " + (q.get("reason") || ""));
  }, []);

  async function save(patch: Partial<GcalState>) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await apiMutate("/api/settings", "PATCH", {
        googleCalendar: patch,
      });
      const body = (await res.json()) as {
        error?: string;
        data?: { googleCalendar: GcalState };
      };
      if (!res.ok) throw new Error(body.error || "Ошибка");
      setGcal(body.data!.googleCalendar);
      setMsg("Настройки календаря сохранены.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await apiMutate("/api/google/calendar/sync", "POST");
      const body = (await res.json()) as {
        error?: string;
        data?: {
          ok: boolean;
          upserted: number;
          skipped: number;
          error?: string;
          errors?: string[];
        };
      };
      if (!res.ok && !body.data)
        throw new Error(body.error || "Ошибка синхронизации");
      const d = body.data!;
      if (!d.ok) setErr(d.error || "Синхронизация не удалась");
      else {
        let text =
          "Синхронизация: обновлено " + d.upserted + ", пропущено " + d.skipped;
        if (d.errors && d.errors.length)
          text += ". " + d.errors.slice(0, 2).join("; ");
        if (d.error) text += ". " + d.error;
        setMsg(text);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!gcal) {
    return (
      <p className="text-sm text-zinc-500">Загрузка настроек календаря…</p>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <ProviderIcon provider="google" size={36} />
        <div>
          <h2 className="text-lg font-semibold">Google Calendar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            OAuth-подключение. В день оплаты (или за день) создаётся событие-
            напоминание для активных подписок с датой next_billing. Нужны{" "}
            GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в env на Render. Токены
            хранятся зашифрованными.
          </p>
        </div>
      </div>

      {msg ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={gcal.enabled}
            disabled={busy}
            onChange={(e) => void save({ enabled: e.target.checked })}
          />
          Включить напоминания в Google Calendar
        </label>

        <label className="block text-sm">
          Когда создавать событие
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={gcal.remindOn}
            disabled={busy}
            onChange={(e) =>
              void save({
                remindOn: e.target.value as "day_of" | "day_before",
              })
            }
          >
            <option value="day_of">В день оплаты</option>
            <option value="day_before">За день до оплаты</option>
          </select>
        </label>

        <label className="block text-sm">
          ID календаря
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            defaultValue={gcal.calendarId}
            disabled={busy}
            onBlur={(e) => {
              const v = e.target.value.trim() || "primary";
              if (v !== gcal.calendarId) void save({ calendarId: v });
            }}
            placeholder="primary"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className={
              "rounded-full px-2.5 py-1 text-xs font-medium " +
              (gcal.connected
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            {gcal.connected ? "Google подключён" : "Не подключён"}
          </span>
          {!gcal.oauthConfigured ? (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Env GOOGLE_CLIENT_* не задан
            </span>
          ) : (
            <a
              href="/api/google/oauth/start" target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg bg-[#4285f4] px-3 py-2.5 text-sm font-medium text-white"
            >
              {gcal.connected
                ? "Переподключить Google"
                : "Подключить Google Calendar"}
            </a>
          )}
          <button
            type="button"
            disabled={busy || !gcal.connected || !gcal.enabled}
            onClick={() => void syncNow()}
            className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-3 py-2.5 text-sm disabled:opacity-50 dark:border-zinc-600"
          >
            Синхронизировать сейчас
          </button>
        </div>
      </div>
    </section>
  );
}