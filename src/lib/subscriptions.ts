import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import {
  subscriptions,
  usageSnapshots,
  type NewSubscription,
  type Subscription,
  type UsageSnapshot,
} from "@/db/schema";
import { MOCK_SUBSCRIPTIONS, MOCK_USAGE } from "@/db/mock";

export function usingMock(): boolean {
  return !hasDatabaseUrl() && process.env.ALLOW_MOCK_DATA === "true";
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const db = getDb();
  if (!db) {
    if (usingMock()) return [...MOCK_SUBSCRIPTIONS];
    throw new Error("DATABASE_URL не задан");
  }
  return db.select().from(subscriptions).orderBy(asc(subscriptions.nextBillingAt));
}

export async function getSubscription(id: string): Promise<Subscription | null> {
  const db = getDb();
  if (!db) {
    if (usingMock()) return MOCK_SUBSCRIPTIONS.find((s) => s.id === id) ?? null;
    throw new Error("DATABASE_URL не задан");
  }
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSubscription(
  data: NewSubscription
): Promise<Subscription> {
  const db = getDb();
  if (!db) throw new Error("CRUD требует DATABASE_URL");
  const rows = await db.insert(subscriptions).values(data).returning();
  return rows[0]!;
}

export async function updateSubscription(
  id: string,
  data: Partial<NewSubscription>
): Promise<Subscription | null> {
  const db = getDb();
  if (!db) throw new Error("CRUD требует DATABASE_URL");
  const rows = await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteSubscription(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("CRUD требует DATABASE_URL");
  const rows = await db
    .delete(subscriptions)
    .where(eq(subscriptions.id, id))
    .returning({ id: subscriptions.id });
  return rows.length > 0;
}

function labelRank(label: string): number {
  if (/5\s*h|5ч|five_hour|five-hour/i.test(label)) return 0;
  if (/неделя|7\s*d|7дн|seven_day|week/i.test(label)) return 1;
  return 10;
}

/** Latest snapshot per label for a subscription (snaps must be newest-first). */
function latestSnapsByLabel(
  snaps: UsageSnapshot[],
  subscriptionId: string
): UsageSnapshot[] {
  const mine = snaps.filter((s) => s.subscriptionId === subscriptionId);
  if (mine.length === 0) return [];
  const seen = new Set<string>();
  const out: UsageSnapshot[] = [];
  for (const s of mine) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    out.push(s);
  }
  out.sort((a, b) => labelRank(a.label) - labelRank(b.label));
  return out;
}

export async function latestUsageForProviders(
  providers: string[]
): Promise<{ sub: Subscription; snaps: UsageSnapshot[] }[]> {
  const all = await listSubscriptions();
  const relevant = all.filter(
    (s) => s.isActive && providers.includes(s.provider)
  );
  const db = getDb();
  if (!db) {
    return relevant.map((sub) => ({
      sub,
      snaps: MOCK_USAGE.filter((u) => u.subscriptionId === sub.id),
    }));
  }
  const ids = relevant.map((s) => s.id);
  if (ids.length === 0) return [];
  const snaps = await db
    .select()
    .from(usageSnapshots)
    .where(inArray(usageSnapshots.subscriptionId, ids))
    .orderBy(desc(usageSnapshots.capturedAt));

  return relevant.map((sub) => ({
    sub,
    snaps: latestSnapsByLabel(snaps, sub.id),
  }));
}

export async function listLatestUsage(): Promise<UsageSnapshot[]> {
  const db = getDb();
  if (!db) {
    if (usingMock()) return [...MOCK_USAGE];
    throw new Error("DATABASE_URL не задан");
  }
  return db
    .select()
    .from(usageSnapshots)
    .orderBy(desc(usageSnapshots.capturedAt))
    .limit(50);
}

/** Apply real billing fields from provider refresh. Only defined keys are written. */
export async function applyProviderBilling(
  subscriptionId: string,
  billing: {
    name?: string;
    amountCents?: number | null;
    currency?: string;
    nextBillingAt?: string | null;
    billingPeriod?: string;
  }
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const patch: Partial<NewSubscription> = { updatedAt: new Date() };
  if (billing.name != null && billing.name.trim()) patch.name = billing.name.trim();
  if ("amountCents" in billing) patch.amountCents = billing.amountCents ?? null;
  if (billing.currency != null && billing.currency.trim()) {
    patch.currency = billing.currency.trim().toUpperCase();
  }
  if ("nextBillingAt" in billing) {
    patch.nextBillingAt = billing.nextBillingAt ?? null;
  }
  if (billing.billingPeriod != null && billing.billingPeriod.trim()) {
    patch.billingPeriod = billing.billingPeriod.trim();
  }
  const keys = Object.keys(patch).filter((k) => k !== "updatedAt");
  if (keys.length === 0) return;
  await db
    .update(subscriptions)
    .set(patch)
    .where(eq(subscriptions.id, subscriptionId));
}
