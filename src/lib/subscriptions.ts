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

export async function latestUsageForProviders(
  providers: string[]
): Promise<{ sub: Subscription; snap: UsageSnapshot | null }[]> {
  const all = await listSubscriptions();
  const relevant = all.filter(
    (s) => s.isActive && providers.includes(s.provider)
  );
  const db = getDb();
  if (!db) {
    return relevant.map((sub) => ({
      sub,
      snap: MOCK_USAGE.find((u) => u.subscriptionId === sub.id) ?? null,
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
    snap: snaps.find((s) => s.subscriptionId === sub.id) ?? null,
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
