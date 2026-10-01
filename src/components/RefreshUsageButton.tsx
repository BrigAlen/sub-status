"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMutate } from "@/lib/client-csrf";

type Report = {
  provider: string;
  ok: boolean;
  error?: string;
  snapshots?: number;
};

export function RefreshUsageButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setNote(null);
    try {
      const res = await apiMutate("/api/usage/refresh", "POST");
      const body = (await res.json()) as {
        error?: string;
        data?: { reports: Report[] };
      };
      if (!res.ok) throw new Error(body.error || "Ошибка обновления");
      const reports = body.data?.reports ?? [];
      const parts = reports.map((r) => {
        if (r.ok) return r.provider + ": ок" + (r.snapshots ? " (" + r.snapshots + ")" : "");
        return r.provider + ": " + (r.error || "ошибка");
      });
      setNote(parts.join(" · ") || "Готово");
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {busy ? "Обновление…" : "Обновить лимиты"}
      </button>
      {note ? (
        <p className="max-w-xs text-right text-xs text-zinc-500">{note}</p>
      ) : null}
    </div>
  );
}
