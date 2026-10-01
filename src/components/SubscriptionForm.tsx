"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMutate } from "@/lib/client-csrf";

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
  ["other", "Другое"],
] as const;

const currencies = [
  ["BYN", "🇧🇾 BYN"],
  ["EUR", "🇪🇺 EUR"],
  ["USD", "🇺🇸 USD"],
] as const;

export function SubscriptionForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      currency: String(fd.get("currency") || "BYN"),
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
    initial?.amountCents != null ? (initial.amountCents / 100).toString() : "";

  const field =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4">
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
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Сумма
          <input name="amount" type="number" step="0.01" min="0" defaultValue={amountDefault} className={field} />
        </label>
        <label className="block text-sm">
          Валюта
          <select
            name="currency"
            defaultValue={
              ["BYN", "EUR", "USD"].includes(initial?.currency || "")
                ? initial!.currency!
                : initial?.currency
                  ? initial.currency
                  : "BYN"
            }
            className={field}
          >
            {currencies.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
            {initial?.currency &&
            !["BYN", "EUR", "USD"].includes(initial.currency) ? (
              <option value={initial.currency}>{initial.currency}</option>
            ) : null}
          </select>
        </label>
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
        <textarea name="notes" rows={3} defaultValue={initial?.notes || ""} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={initial?.isActive !== false} />
        Активна
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="calendarRemind"
          type="checkbox"
          defaultChecked={initial?.calendarRemind !== false}
        />
        Напоминание в Google Calendar
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Сохранение…" : editing ? "Сохранить" : "Добавить"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
          >
            Удалить
          </button>
        ) : null}
      </div>
    </form>
  );
}
