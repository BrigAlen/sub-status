-- Google Calendar reminders + app_settings
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "calendar_remind" boolean DEFAULT true NOT NULL;

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
