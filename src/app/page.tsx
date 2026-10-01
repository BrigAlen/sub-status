import Link from "next/link";
import { LimitCard } from "@/components/LimitCard";
import { PaymentRow } from "@/components/PaymentRow";
import {
  latestUsageForProviders,
  listSubscriptions,
  usingMock,
} from "@/lib/subscriptions";
import { stubClaudeUsage, stubCursorUsage } from "@/providers/stub";

export const dynamic = "force-dynamic";

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

  function cardFor(provider: "cursor" | "claude") {
    const found = limitRows.find((r) => r.sub.provider === provider);
    const stub = provider === "cursor" ? cursorStub : claudeStub;
    if (found && found.snap) {
      const pct =
        found.snap.usedPercent != null ? Number(found.snap.usedPercent) : null;
      return (
        <LimitCard
          key={provider}
          provider={provider}
          name={found.sub.name}
          usedPercent={pct}
          remainingText={found.snap.remainingText}
          resetsAt={
            found.snap.resetsAt ? found.snap.resetsAt.toISOString() : null
          }
          label={found.snap.label}
          stubNote={mock ? stub.note : undefined}
        />
      );
    }
    return (
      <LimitCard
        key={provider}
        provider={provider}
        name={provider === "cursor" ? "Cursor Pro" : "Claude Pro"}
        usedPercent={stub.usedPercent}
        remainingText={stub.remainingText}
        resetsAt={stub.resetsAt}
        label={stub.label}
        stubNote={stub.note}
      />
    );
  }

  const sorted = payments.slice().sort(function (a, b) {
    if (!a.nextBillingAt) return 1;
    if (!b.nextBillingAt) return -1;
    return a.nextBillingAt.localeCompare(b.nextBillingAt);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Обзор</h1>
          <p className="text-sm text-zinc-500">
            Лимиты использования и ближайшие оплаты
            {mock ? " · демо-данные (нет DATABASE_URL)" : ""}
          </p>
        </div>
        <Link
          href="/subscriptions/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Добавить подписку
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}. Показаны заглушки.
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Лимиты</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {cardFor("cursor")}
          {cardFor("claude")}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Оплаты</h2>
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
