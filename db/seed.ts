import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  const inDays = (d: number) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  };

  const inserted = await db
    .insert(schema.subscriptions)
    .values([
      {
        name: "Cursor Pro",
        provider: "cursor",
        kind: "both",
        amountCents: 2000,
        currency: "USD",
        billingPeriod: "monthly",
        nextBillingAt: inDays(12),
        notes: "Seed: Cursor subscription (usage limits)",
        isActive: true,
      },
      {
        name: "Claude Pro",
        provider: "claude",
        kind: "both",
        amountCents: 2000,
        currency: "USD",
        billingPeriod: "monthly",
        nextBillingAt: inDays(5),
        notes: "Seed: Claude subscription (usage limits)",
        isActive: true,
      },
      {
        name: "Google One",
        provider: "google",
        kind: "billing_only",
        amountCents: 29900,
        currency: "RUB",
        billingPeriod: "monthly",
        nextBillingAt: inDays(18),
        isActive: true,
      },
      {
        name: "Яндекс 360",
        provider: "yandex",
        kind: "billing_only",
        amountCents: 39900,
        currency: "RUB",
        billingPeriod: "monthly",
        nextBillingAt: inDays(22),
        isActive: true,
      },
      {
        name: "Boosty",
        provider: "boosty",
        kind: "billing_only",
        amountCents: 50000,
        currency: "RUB",
        billingPeriod: "monthly",
        nextBillingAt: inDays(3),
        notes: "Неактивный seed",
        isActive: false,
      },
    ])
    .returning();

  const cursor = inserted.find((s) => s.provider === "cursor")!;
  const claude = inserted.find((s) => s.provider === "claude")!;

  await db.insert(schema.usageSnapshots).values([
    {
      subscriptionId: cursor.id,
      source: "manual",
      label: "cursor pool",
      usedPercent: "68.00",
      remainingText: "~32% пула",
      resetsAt: new Date(Date.now() + 2 * 86400000),
      rawJson: { seed: true },
    },
    {
      subscriptionId: claude.id,
      source: "manual",
      label: "5h window",
      usedPercent: "42.00",
      remainingText: "осталось ~3ч",
      resetsAt: new Date(Date.now() + 5 * 3600000),
      rawJson: { seed: true },
    },
  ]);

  console.log("Seed OK:", inserted.length, "subscriptions");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
