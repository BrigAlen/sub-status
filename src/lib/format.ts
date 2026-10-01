export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
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
