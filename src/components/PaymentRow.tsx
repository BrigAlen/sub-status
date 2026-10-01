import Link from "next/link";
import { daysUntil, formatMoney, providerLabel } from "@/lib/format";
import type { Subscription } from "@/db/schema";
import { ProviderIcon } from "@/components/ProviderIcon";

export function PaymentRow({ sub }: { sub: Subscription }) {
  const days = daysUntil(sub.nextBillingAt);
  let badge = "text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300";
  let daysText = "дата не указана";
  if (days != null) {
    if (days < 0) {
      badge = "text-red-700 bg-red-100 dark:bg-red-950 dark:text-red-300";
      daysText = "просрочено на " + Math.abs(days) + " дн.";
    } else if (days <= 3) {
      badge = "text-amber-800 bg-amber-100 dark:bg-amber-950 dark:text-amber-200";
      daysText = "через " + days + " дн.";
    } else if (days <= 7) {
      badge = "text-orange-800 bg-orange-100 dark:bg-orange-950 dark:text-orange-200";
      daysText = "через " + days + " дн.";
    } else {
      daysText = "через " + days + " дн.";
    }
  }

  return (
    <Link
      href={"/subscriptions/" + sub.id + "/edit"}
      className={
        "flex min-w-0 flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 " +
        (!sub.isActive ? "opacity-50" : "")
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <ProviderIcon provider={sub.provider} size={32} />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {sub.name}{" "}
            <span className="text-xs font-normal text-zinc-500">
              ({providerLabel(sub.provider)})
            </span>
          </p>
          <p className="text-sm text-zinc-500">
            {formatMoney(sub.amountCents, sub.currency)} · {sub.billingPeriod}
            {!sub.isActive ? " · неактивна" : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
        <span className={"inline-block rounded-full px-2.5 py-1 text-xs font-medium " + badge}>
          {daysText}
        </span>
        <p className="text-xs text-zinc-400">{sub.nextBillingAt || "—"}</p>
      </div>
    </Link>
  );
}
