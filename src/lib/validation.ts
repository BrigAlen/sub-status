import { z } from "zod";

export const providerEnum = z.enum([
  "cursor",
  "claude",
  "google",
  "yandex",
  "boosty",
  "apple",
  "other",
]);

export const kindEnum = z.enum(["usage_limit", "billing_only", "both"]);
export const periodEnum = z.enum(["monthly", "yearly", "custom"]);

export const subscriptionCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  provider: providerEnum,
  kind: kindEnum,
  amountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  currency: z.string().trim().min(3).max(3).default("RUB"),
  billingPeriod: periodEnum,
  nextBillingAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  calendarRemind: z.boolean().optional().default(true),
});

export const subscriptionUpdateSchema = subscriptionCreateSchema.partial();

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export const providerCredentialSchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  provider: z.enum(["cursor", "claude"]),
  label: z.string().trim().min(1).max(80).default("default"),
  secret: z.string().min(1).max(8000),
});
