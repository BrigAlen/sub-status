import Link from "next/link";
import { listSubscriptions, usingMock } from "@/lib/subscriptions";
import { formatMoney, kindLabel, providerLabel, daysUntil } from "@/lib/format";
import { ProviderIcon } from "@/components/ProviderIcon";

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
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Подписки</h1>
          <p className="text-sm text-zinc-500">
            Ручное управление{mock ? " · демо" : ""}
          </p>
        </div>
        <Link
          href="/subscriptions/new"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 sm:w-auto"
        >
          Добавить
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 && !error ? (
        <p className="rounded-xl border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          Подписок пока нет
        </p>
      ) : null}
      <ul className="space-y-3">
        {rows.map(function (s) {
          const d = daysUntil(s.nextBillingAt);
          return (
            <li
              key={s.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <ProviderIcon provider={s.provider} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {s.name}
                      {!s.isActive ? (
                        <span className="ml-1 text-xs font-normal text-zinc-400">
                          (выкл)
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {providerLabel(s.provider)} · {kindLabel(s.kind)}
                    </p>
                  </div>
                </div>
                <Link
                  href={"/subscriptions/" + s.id + "/edit"}
                  className="shrink-0 text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Изменить
                </Link>
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
                <p className="font-medium">
                  {formatMoney(s.amountCents, s.currency)}
                </p>
                <p className="text-zinc-500">
                  {s.nextBillingAt ? (
                    <>
                      {s.nextBillingAt}
                      {d != null ? (
                        <span className="ml-1 text-xs text-zinc-400">
                          ({d} дн.)
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}