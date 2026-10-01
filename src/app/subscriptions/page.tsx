import Link from "next/link";
import { listSubscriptions, usingMock } from "@/lib/subscriptions";
import { formatMoney, kindLabel, providerLabel, daysUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  let rows: Awaited<ReturnType<typeof listSubscriptions>> = [];
  let mock = false;
  let error: string | null = null;
  try {
    mock = usingMock();
    rows = await listSubscriptions();
  } catch (e) {
    error = e instanceof Error ? e.message : "Ошибка";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Подписки</h1>
          <p className="text-sm text-zinc-500">
            Ручное управление{mock ? " · демо" : ""}
          </p>
        </div>
        <Link
          href="/subscriptions/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Добавить
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Название</th>
              <th className="px-3 py-2">Провайдер</th>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2">Сумма</th>
              <th className="px-3 py-2">Оплата</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(function (s) {
              const d = daysUntil(s.nextBillingAt);
              return (
                <tr
                  key={s.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2 font-medium">
                    {s.name}
                    {!s.isActive ? (
                      <span className="ml-1 text-xs text-zinc-400">выкл</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{providerLabel(s.provider)}</td>
                  <td className="px-3 py-2">{kindLabel(s.kind)}</td>
                  <td className="px-3 py-2">
                    {formatMoney(s.amountCents, s.currency)}
                  </td>
                  <td className="px-3 py-2">
                    {s.nextBillingAt || "—"}
                    {d != null ? (
                      <span className="ml-1 text-xs text-zinc-400">
                        ({d} дн.)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={"/subscriptions/" + s.id + "/edit"}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Изменить
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
