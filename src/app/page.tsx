import Link from "next/link";
import { LimitCard } from "@/components/LimitCard";
import { PaymentRow } from "@/components/PaymentRow";
import { RefreshUsageButton } from "@/components/RefreshUsageButton";
import {
  latestUsageForProviders,
  listSubscriptions,
  usingMock,
} from "@/lib/subscriptions";
import { stubClaudeUsage, stubCursorUsage } from "@/providers/stub";
import {
  formatDateTime,
  formatMonthlyTotals,
  sumActiveMonthlyByCurrency,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default async function DashboardPage() {
  let limitRows: Awaited<ReturnType<typeof latestUsageForProviders>> = [];
  let payments: Awaited<ReturnType<typeof listSubscriptions>> = [];
  let mock = false;
  let error: string | null = null;

  try {
    mock = usingMock();
    limitRows = await latestUsageForProviders(["cursor", "claude"]);
    payments = await listSubscriptions();
  } catch (e) {
    error = e instanceof Error ? e.message : "Ошибка загрузки";
    mock = true;
  }

  const cursorStub = stubCursorUsage();
  const claudeStub = stubClaudeUsage();

  function cardsFor(provider: "cursor" | "claude") {
    const found = limitRows.find((r) => r.sub.provider === provider);
    const stub = provider === "cursor" ? cursorStub : claudeStub;
    const name =
      found?.sub.name ??
      (provider === "cursor" ? "Cursor Pro" : "Claude Pro");

    if (found && found.snaps.length > 0) {
      return found.snaps.map((snap) => {
        const pct =
          snap.usedPercent != null ? Number(snap.usedPercent) : null;
        return (
          <LimitCard
            key={provider + ":" + snap.label + ":" + snap.id}
            provider={provider}
            name={name}
            usedPercent={pct}
            remainingText={snap.remainingText}
            resetsAt={snap.resetsAt ? snap.resetsAt.toISOString() : null}
            label={snap.label}
            capturedAt={
              snap.capturedAt ? snap.capturedAt.toISOString() : null
            }
            stubNote={mock ? stub.note : undefined}
          />
        );
      });
    }

    return [
      <LimitCard
        key={provider + ":empty"}
        provider={provider}
        name={name}
        usedPercent={null}
        remainingText={null}
        resetsAt={null}
        label={stub.label}
        stubNote={stub.note}
      />,
    ];
  }

  const sorted = payments.slice().sort(function (a, b) {
    if (!a.nextBillingAt) return 1;
    if (!b.nextBillingAt) return -1;
    return a.nextBillingAt.localeCompare(b.nextBillingAt);
  });

  const monthlyTotals = sumActiveMonthlyByCurrency(payments);
  const monthlyTotalsText = formatMonthlyTotals(monthlyTotals);

  const lastSync = limitRows
    .flatMap((r) => r.snaps.map((s) => s.capturedAt))
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="min-w-0 w-full max-w-full space-y-5 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Обзор</h1>
          <p className="text-sm text-zinc-500">
            Лимиты использования и ближайшие оплаты
            {mock ? " · демо-данные (нет DATABASE_URL)" : ""}
            {lastSync ? " · синхр. " + formatDateTime(lastSync) : ""}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <RefreshUsageButton />
          <Link
            href="/settings"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <GearIcon />
            Настройки
          </Link>
          <Link
            href="/subscriptions/new"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 sm:w-auto"
          >
            <PlusIcon />
            Добавить подписку
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}. Показаны подсказки вместо данных.
        </p>
      ) : null}

      <section>
        <h2 className="mb-2 text-base font-semibold sm:mb-3 sm:text-lg">Лимиты</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cardsFor("cursor")}
          {cardsFor("claude")}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold sm:text-lg">Оплаты</h2>
          {monthlyTotalsText ? (
            <p className="text-sm font-medium text-zinc-200">
              <span className="text-zinc-500">Итого: </span>
              {monthlyTotalsText}
              <span className="text-zinc-500"> в месяц</span>
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-zinc-500">Подписок пока нет.</p>
          ) : (
            sorted.map(function (sub) {
              return <PaymentRow key={sub.id} sub={sub} />;
            })
          )}
        </div>
      </section>
    </div>
  );
}
