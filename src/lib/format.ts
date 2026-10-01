/** Display / calendar TZ. Prefer APP_TZ (server) or NEXT_PUBLIC_APP_TZ (client). */
export function appTimeZone(): string {
  return (
    process.env.NEXT_PUBLIC_APP_TZ ||
    process.env.APP_TZ ||
    "Europe/Moscow"
  );
}

function ymdInTz(d: Date, timeZone: string): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const tz = appTimeZone();
  const todayYmd = ymdInTz(new Date(), tz);
  const targetYmd = dateStr.slice(0, 10);
  const t0 = Date.parse(todayYmd + "T00:00:00Z");
  const t1 = Date.parse(targetYmd + "T00:00:00Z");
  return Math.round((t1 - t0) / 86400000);
}

/** Format instant in APP_TZ (default Europe/Moscow). Do not invent offsets by hand. */
export function formatDateTime(
  input: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (input == null || input === "") return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: appTimeZone(),
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(d);
}

export function formatMoney(cents: number | null | undefined, currency = "RUB"): string {
  if (cents == null) return "\u2014";
  try {
    // Keep fractional major units (e.g. 5.99); do not round to whole currency units.
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2) + " " + currency;
  }
}

export function providerLabel(p: string): string {
  const map: Record<string, string> = {
    cursor: "Cursor",
    claude: "Claude",
    google: "Google",
    yandex: "\u042f\u043d\u0434\u0435\u043a\u0441",
    boosty: "Boosty",
    apple: "Apple",
    mullvad: "Mullvad",
    other: "\u0414\u0440\u0443\u0433\u043e\u0435",
  };
  return map[p] ?? p;
}

export function kindLabel(k: string): string {
  const map: Record<string, string> = {
    usage_limit: "\u041b\u0438\u043c\u0438\u0442 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f",
    billing_only: "\u0422\u043e\u043b\u044c\u043a\u043e \u043e\u043f\u043b\u0430\u0442\u0430",
    both: "\u041b\u0438\u043c\u0438\u0442 + \u043e\u043f\u043b\u0430\u0442\u0430",
  };
  return map[k] ?? k;
}

/** Convert billed amount to monthly cents. yearly -> /12; monthly/custom/other -> as listed. */
export function monthlyAmountCents(
  amountCents: number | null | undefined,
  billingPeriod: string | null | undefined
): number | null {
  if (amountCents == null || !Number.isFinite(amountCents)) return null;
  const period = (billingPeriod || "monthly").toLowerCase();
  if (period === "yearly") return Math.round(amountCents / 12);
  return amountCents;
}

const CURRENCY_ORDER = ["EUR", "USD", "BYN", "RUB"];

/**
 * Sum active subscriptions as monthly equivalents, grouped by currency.
 * Separate totals per currency; Overview also shows a BYN FX sum when NBRB rates are available.
 */
export function sumActiveMonthlyByCurrency(
  subs: Array<{
    isActive: boolean;
    amountCents: number | null;
    currency: string;
    billingPeriod: string;
  }>
): { currency: string; cents: number }[] {
  const map = new Map<string, number>();
  for (const sub of subs) {
    if (!sub.isActive) continue;
    const monthly = monthlyAmountCents(sub.amountCents, sub.billingPeriod);
    if (monthly == null) continue;
    const cur = (sub.currency || "BYN").toUpperCase();
    map.set(cur, (map.get(cur) || 0) + monthly);
  }
  const keys = Array.from(map.keys()).sort((a, b) => {
    const ia = CURRENCY_ORDER.indexOf(a);
    const ib = CURRENCY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return keys.map((currency) => ({ currency, cents: map.get(currency)! }));
}

/** Join per-currency monthly totals via formatMoney (keeps up to 2 fraction digits). */
export function formatMonthlyTotals(
  totals: { currency: string; cents: number }[]
): string {
  if (totals.length === 0) return "";
  return totals.map((t) => formatMoney(t.cents, t.currency)).join(" · ");
}
/** Format NBRB rate date YYYY-MM-DD as DD.MM.YYYY for UI note. */
export function formatFxRateDate(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  return m[3] + "." + m[2] + "." + m[1];
}

/**
 * Label for Overview BYN FX total, e.g. "\u2248 12,34 BYN \u0432 \u043c\u0435\u0441\u044f\u0446".
 * Optional rate-date note: "\u00b7 \u043a\u0443\u0440\u0441 \u041d\u0411\u0420\u0411 DD.MM.YYYY".
 */
export function formatBynMonthlyTotalLabel(
  bynCents: number,
  rateDateYmd?: string | null
): string {
  const money = formatMoney(bynCents, "BYN");
  let s = "\u2248 " + money + " \u0432 \u043c\u0435\u0441\u044f\u0446";
  const d = formatFxRateDate(rateDateYmd);
  if (d) s += " \u00b7 \u043a\u0443\u0440\u0441 \u041d\u0411\u0420\u0411 " + d;
  return s;
}
