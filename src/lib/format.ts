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
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
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
