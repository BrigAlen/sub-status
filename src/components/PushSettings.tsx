"use client";

import { useEffect, useState } from "react";
import { apiMutate } from "@/lib/client-csrf";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "loading" | "unsupported" | "need-vapid" | "off" | "on" | "denied";

export function PushSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setErr(null);
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const vapidRes = await fetch("/api/push/vapid-public", {
        credentials: "same-origin",
      });
      const vapid = (await vapidRes.json()) as { publicKey?: string };
      if (!vapid.publicKey) {
        setStatus("need-vapid");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const vapidRes = await fetch("/api/push/vapid-public", {
        credentials: "same-origin",
      });
      const vapid = (await vapidRes.json()) as { publicKey?: string };
      if (!vapid.publicKey) throw new Error("VAPID_PUBLIC_KEY не задан на сервере");

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        throw new Error("Разрешение на уведомления не выдано");
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapid.publicKey
        ) as BufferSource,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Браузер не вернул ключи подписки");
      }
      const res = await apiMutate("/api/push/subscribe", "POST", {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Не удалось сохранить подписку");
      setStatus("on");
      setMsg(
        "Push включён. За день до оплаты придёт «Завтра оплата» (нужен ежедневный cron)."
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiMutate("/api/push/subscribe", "DELETE", { endpoint });
      }
      setStatus("off");
      setMsg("Push выключен на этом устройстве.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const badge =
    status === "on"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "denied" || status === "need-vapid" || status === "unsupported"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  const label =
    status === "loading"
      ? "…"
      : status === "on"
        ? "Включено"
        : status === "denied"
          ? "Запрещено в браузере"
          : status === "need-vapid"
            ? "VAPID не настроен"
            : status === "unsupported"
              ? "Не поддерживается"
              : "Выключено";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Web Push напоминания</h2>
          <p className="mt-1 text-sm text-zinc-500">
            За день до оплаты: уведомление «Завтра оплата». На iOS сначала
            установите приложение на домашний экран (PWA), затем включите
            push. Нужны VAPID_* и ежедневный cron на Render.
          </p>
        </div>
        <span
          className={
            "inline-flex shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-medium " +
            badge
          }
        >
          {label}
        </span>
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {status === "on" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disable()}
            className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-600"
          >
            {busy ? "…" : "Выключить на этом устройстве"}
          </button>
        ) : status === "off" || status === "need-vapid" ? (
          <button
            type="button"
            disabled={busy || status === "need-vapid"}
            onClick={() => void enable()}
            className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Подключение…" : "Включить напоминания"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
