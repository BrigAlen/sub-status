/**
 * NBRB (National Bank of Belarus) FX rates -> BYN.
 * Cache ~1h in-memory. Fail soft: callers skip BYN total if rates missing.
 * No invented rates.
 */

const NBRB_RATES_URL = "https://api.nbrb.by/exrates/rates?periodicity=0";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export type BynFxRates = {
  /** BYN per 1 unit of foreign currency (OfficialRate / Scale). BYN itself is 1. */
  bynPerUnit: Record<string, number>;
  /** Rate date from NBRB (YYYY-MM-DD), or null if unavailable. */
  date: string | null;
  ok: boolean;
};

type CacheEntry = { expiresAt: number; value: BynFxRates };

let cache: CacheEntry | null = null;

type NbrbRate = {
  Cur_Abbreviation?: string;
  Cur_Scale?: number;
  Cur_OfficialRate?: number;
  Date?: string;
};

function ymdFromNbrbDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function emptyFail(): BynFxRates {
  return { bynPerUnit: { BYN: 1 }, date: null, ok: false };
}

async function fetchNbrbDailyRates(): Promise<BynFxRates> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(NBRB_RATES_URL, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      // Avoid Next.js Data Cache sticking forever; we manage our own TTL.
      cache: "no-store",
    });
    if (!res.ok) return emptyFail();
    const data = (await res.json()) as NbrbRate[];
    if (!Array.isArray(data) || data.length === 0) return emptyFail();

    const bynPerUnit: Record<string, number> = { BYN: 1 };
    let date: string | null = null;

    for (const row of data) {
      const abbr = (row.Cur_Abbreviation || "").toUpperCase();
      const scale = Number(row.Cur_Scale);
      const official = Number(row.Cur_OfficialRate);
      if (!abbr || !Number.isFinite(scale) || scale <= 0) continue;
      if (!Number.isFinite(official) || official <= 0) continue;
      bynPerUnit[abbr] = official / scale;
      if (!date) date = ymdFromNbrbDate(row.Date);
    }

    if (Object.keys(bynPerUnit).length <= 1) return emptyFail();
    return { bynPerUnit, date, ok: true };
  } catch {
    return emptyFail();
  } finally {
    clearTimeout(timer);
  }
}

/** Cached NBRB daily rates (BYN per unit). Soft-fails without throwing. */
export async function getBynFxRates(): Promise<BynFxRates> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const value = await fetchNbrbDailyRates();
  // Cache successes and soft failures briefly to avoid hammering NBRB on errors.
  cache = {
    expiresAt: now + (value.ok ? CACHE_TTL_MS : 5 * 60 * 1000),
    value,
  };
  return value;
}

/**
 * Convert monthly per-currency cents totals to a single BYN cents total.
 * Returns null if any non-BYN currency lacks a rate (fail soft).
 */
export function convertMonthlyTotalsToBynCents(
  totals: { currency: string; cents: number }[],
  rates: BynFxRates
): number | null {
  if (totals.length === 0) return null;

  let sum = 0;
  for (const t of totals) {
    const cur = (t.currency || "BYN").toUpperCase();
    if (cur === "BYN") {
      sum += t.cents;
      continue;
    }
    if (!rates.ok) return null;
    const per = rates.bynPerUnit[cur];
    if (per == null || !Number.isFinite(per) || per <= 0) return null;
    // cents_foreign / 100 * bynPerUnit * 100
    sum += Math.round(t.cents * per);
  }
  return sum;
}