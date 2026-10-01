import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { subscriptions, type Subscription } from "@/db/schema";

const DEFAULTS: Record<
  "cursor" | "claude",
  { name: string; kind: string; amountCents: number; currency: string }
> = {
  cursor: {
    name: "Cursor Pro",
    kind: "both",
    amountCents: 2000,
    currency: "USD",
  },
  claude: {
    name: "Claude Pro",
    kind: "both",
    amountCents: 2000,
    currency: "USD",
  },
};

/** Find active subscription by provider or create Cursor Pro / Claude Pro. */
export async function ensureProviderSubscription(
  provider: "cursor" | "claude"
): Promise<Subscription> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL требуется");

  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.provider, provider))
    .limit(1);

  if (existing[0]) return existing[0];

  const def = DEFAULTS[provider];
  const next = new Date();
  next.setDate(next.getDate() + 30);
  const rows = await db
    .insert(subscriptions)
    .values({
      name: def.name,
      provider,
      kind: def.kind,
      amountCents: def.amountCents,
      currency: def.currency,
      billingPeriod: "monthly",
      nextBillingAt: next.toISOString().slice(0, 10),
      notes: "Автосоздано при сохранении учётных данных",
      isActive: true,
      calendarRemind: true,
    })
    .returning();
  return rows[0]!;
}
