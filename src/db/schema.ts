import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents"),
  currency: text("currency").default("RUB").notNull(),
  billingPeriod: text("billing_period").notNull(),
  nextBillingAt: date("next_billing_at"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  calendarRemind: boolean("calendar_remind").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usageSnapshots = pgTable("usage_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  label: text("label").notNull(),
  usedPercent: numeric("used_percent", { precision: 5, scale: 2 }),
  remainingText: text("remaining_text"),
  resetsAt: timestamp("resets_at", { withTimezone: true }),
  rawJson: jsonb("raw_json"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpoint: text("endpoint").notNull(),
    keysP256dh: text("keys_p256dh").notNull(),
    keysAuth: text("keys_auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint)]
);

/** Encrypted provider OAuth/API credentials — ciphertext only, never plaintext */
export const providerCredentials = pgTable("provider_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  label: text("label").default("default").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** App-wide settings (JSON). Secrets stay in provider_credentials. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type UsageSnapshot = typeof usageSnapshots.$inferSelect;
export type NewUsageSnapshot = typeof usageSnapshots.$inferInsert;
export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
