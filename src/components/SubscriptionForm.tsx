"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMutate } from "@/lib/client-csrf";
import { CURRENCY_OPTIONS, CurrencyIcon } from "@/components/CurrencyIcon";

type Initial = {
  id?: string;
  name?: string;
  provider?: string;
  kind?: string;
  amountCents?: number | null;
  currency?: string;
  billingPeriod?: string;
  nextBillingAt?: string | null;
  notes?: string | null;
  isActive?: boolean;
  calendarRemind?: boolean;
};

const providers = [
  ["cursor", "Cursor"],
  ["claude", "Claude"],
  ["google", "Google"],
  ["yandex", "Яндекс"],
  ["boosty", "Boosty"],
  ["apple", "Apple"],
  ["mullvad", "Mullvad"],
  ["other", "Другое"],
] as const;

function resolveCurrency(initial?: Initial): string {
  const c = (initial?.currency || "BYN").toUpperCase();
  if (["BYN", "EUR", "USD"].includes(c)) return c;
  return c || "BYN";
}

export function SubscriptionForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState(resolveCurrency(initial));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const amountRub = fd.get("amount") as string;
    const amountCents =
      amountRub.trim() === ""
        ? null
        : Math.round(parseFloat(amountRub.replace(",", ".")) * 100);

    const body = {
      name: String(fd.get("name") || ""),
      provider: String(fd.get("provider") || "other"),
      kind: String(fd.get("kind") || "billing_only"),
      amountCents: Number.isFinite(amountCents as number) ? amountCents : null,
      currency,
      billingPeriod: String(fd.get("billingPeriod") || "monthly"),
      nextBillingAt: String(fd.get("nextBillingAt") || "") || null,
      notes: String(fd.get("notes") || "") || null,
      isActive: fd.get("isActive") === "on",
      calendarRemind: fd.get("calendarRemind") === "on",
    };

    try {
      const url = editing
        ? "/api/subscriptions/" + initial!.id
        : "/api/subscriptions";
      const method = editing ? "PATCH" : "POST";
      const res = await apiMutate(url, method, body);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        setLoading(false);
        return;
      }
      router.push("/subscriptions");
      router.refresh();
    } catch {
      setError("Сеть или CSRF ошибка");
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm("Удалить подписку?")) return;
    setLoading(true);
    const res = await apiMutate("/api/subscriptions/" + initial.id, "DELETE");
    if (res.ok) {
      router.push("/subscriptions");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Не удалось удалить");
      setLoading(false);
    }
  }

  const amountDefault =
    initial?.amountCents != null
      ? (Number.isInteger(initial.amountCents / 100)
          ? String(initial.amountCents / 100)
          : (initial.amountCents / 100).toFixed(2))
      : "";

  const field =
    "mt-0.5 w-full min-w-0 min-h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-[15px] leading-snug text-zinc-100 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm";

  const known = CURRENCY_OPTIONS.some((o) => o.code === currency);

  return (
    <form onSubmit={onSubmit} className="mx-auto min-w-0 w-full max-w-lg space-y-2.5 sm:space-y-4">
      <label className="block text-sm">
        Название
        <input name="name" required defaultValue={initial?.name || ""} className={field} />
      </label>
      <label className="block text-sm">
        Провайдер
        <select name="provider" defaultValue={initial?.provider || "other"} className={field}>
          {providers.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Тип
        <select name="kind" defaultValue={initial?.kind || "billing_only"} className={field}>
          <option value="billing_only">Только оплата</option>
          <option value="usage_limit">Лимит использования</option>
          <option value="both">Лимит + оплата</option>
        </select>
      </label>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <label className="block text-sm">
          Сумма
          <input name="amount" type="number" step="0.01" min="0" defaultValue={amountDefault} className={field} />
        </label>
        <fieldset className="block text-sm">
          <legend className="mb-0">Валюта</legend>
          <div className="mt-0.5 flex min-w-0 w-full flex-nowrap gap-1.5" role="radiogroup" aria-label="Валюта">
            {CURRENCY_OPTIONS.map(({ code, label }) => {
              const selected = currency === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCurrency(code)}
                  className={
                    "inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition sm:min-h-0 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm " +
                    (selected
                      ? "border-violet-500 bg-violet-600/20 text-violet-200 ring-1 ring-violet-500/60"
                      : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900")
                  }
                >
                  <CurrencyIcon code={code} className="size-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {!known ? (
            <p className="mt-1 text-xs text-zinc-500">
              Текущая валюта в данных: {currency} (не из списка — при сохранении будет выбранная выше)
            </p>
          ) : null}
        </fieldset>
      </div>
      <label className="block text-sm">
        Период
        <select name="billingPeriod" defaultValue={initial?.billingPeriod || "monthly"} className={field}>
          <option value="monthly">Ежемесячно</option>
          <option value="yearly">Ежегодно</option>
          <option value="custom">Другое</option>
        </select>
      </label>
      <label className="block text-sm">
        Следующая оплата
        <input name="nextBillingAt" type="date" defaultValue={initial?.nextBillingAt || ""} className={field} />
      </label>
      <label className="block text-sm">
        Заметки
        <textarea name="notes" rows={2} defaultValue={initial?.notes || ""} className={field + " sm:min-h-[4.5rem]"} />
      </label>
      <label className="flex min-h-9 items-center gap-2 text-sm sm:min-h-10">
        <input name="isActive" type="checkbox" className="size-4 accent-violet-600" defaultChecked={initial?.isActive !== false} />
        Активна
      </label>
      <label className="flex min-h-9 items-center gap-2 text-sm sm:min-h-10">
        <input
          name="calendarRemind"
          type="checkbox"
          className="size-4 accent-violet-600"
          defaultChecked={initial?.calendarRemind !== false}
        />
        Напоминание в Google Calendar
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={loading}
          className="min-h-10 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 sm:min-h-11 sm:w-auto sm:py-2.5"
        >
          {loading ? "Сохранение…" : editing ? "Сохранить" : "Добавить"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
            className="min-h-10 w-full rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 sm:min-h-11 sm:w-auto sm:py-2.5"
          >
            Удалить
          </button>
        ) : null}
      </div>
    </form>
  );
}
