import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { subscriptions, type Subscription } from "@/db/schema";

const DEFAULTS: Record<
  "cursor" | "claude",
  { name: string; kind: string; currency: string }
> = {
  cursor: {
    name: "Cursor",
    kind: "both",
    currency: "USD",
  },
  claude: {
    name: "Claude",
    kind: "both",
    currency: "USD",
  },
};

/** Find active subscription by provider or create Cursor / Claude shell (no invented price/date). */
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
  const rows = await db
    .insert(subscriptions)
    .values({
      name: def.name,
      provider,
      kind: def.kind,
      amountCents: null,
      currency: def.currency,
      billingPeriod: "monthly",
      nextBillingAt: null,
      notes: "Автосоздано при сохранении учётных данных",
      isActive: true,
      calendarRemind: true,
    })
    .returning();
  return rows[0]!;
}
