import webpush from "web-push";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions, subscriptions, appSettings } from "@/db/schema";
import { daysUntil, formatMoney, appTimeZone } from "@/lib/format";

const DEDUP_KEY = "push_reminders_last_ymd";

function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configureVapid(): boolean {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return true;
}

async function readDedupYmd(): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, DEDUP_KEY))
    .limit(1);
  if (!row) return null;
  const v = row.value as unknown;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "ymd" in (v as object)) {
    return String((v as { ymd: string }).ymd);
  }
  return null;
}

async function writeDedupYmd(ymd: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [existing] = await db
    .select({ key: appSettings.key })
    .from(appSettings)
    .where(eq(appSettings.key, DEDUP_KEY))
    .limit(1);
  if (existing) {
    await db
      .update(appSettings)
      .set({ value: { ymd }, updatedAt: new Date() })
      .where(eq(appSettings.key, DEDUP_KEY));
  } else {
    await db.insert(appSettings).values({
      key: DEDUP_KEY,
      value: { ymd },
      updatedAt: new Date(),
    });
  }
}

export type PushSendResult = {
  ok: boolean;
  skipped?: string;
  tomorrowCount: number;
  sent: number;
  failed: number;
  removed: number;
};

/**
 * Active subscriptions with nextBillingAt = tomorrow (APP_TZ) →
 * Web Push «Завтра оплата» to all browser endpoints.
 * Deduped once per calendar day via app_settings.
 */
export async function sendTomorrowPaymentPushes(opts?: {
  force?: boolean;
}): Promise<PushSendResult> {
  const empty: PushSendResult = {
    ok: true,
    tomorrowCount: 0,
    sent: 0,
    failed: 0,
    removed: 0,
  };

  if (!configureVapid()) {
    return { ...empty, ok: false, skipped: "VAPID_* не заданы" };
  }

  const db = getDb();
  if (!db) {
    return { ...empty, ok: false, skipped: "нет DATABASE_URL" };
  }

  const today = todayYmd();
  if (!opts?.force) {
    const last = await readDedupYmd();
    if (last === today) {
      return { ...empty, skipped: "уже отправлено сегодня (" + today + ")" };
    }
  }

  const subs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.isActive, true));

  const due = subs.filter((s) => daysUntil(s.nextBillingAt) === 1);

  if (due.length === 0) {
    await writeDedupYmd(today);
    return { ...empty, skipped: "нет оплат на завтра" };
  }

  const endpoints = await db.select().from(pushSubscriptions);
  if (endpoints.length === 0) {
    return {
      ...empty,
      tomorrowCount: due.length,
      skipped: "нет push-подписок браузера",
    };
  }

  const names = due.map((s) => s.name).join(", ");
  const title = "Завтра оплата";
  const body =
    due.length === 1
      ? due[0].name +
        (due[0].amountCents != null
          ? " — " + formatMoney(due[0].amountCents, due[0].currency)
          : "")
      : due.length + " подписок: " + names;

  const payload = JSON.stringify({ title, body, url: "/" });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const sub of endpoints) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keysP256dh, auth: sub.keysAuth },
        },
        payload,
        { TTL: 60 * 60 * 12 }
      );
      sent += 1;
    } catch (e: unknown) {
      failed += 1;
      const status =
        e && typeof e === "object" && "statusCode" in e
          ? Number((e as { statusCode: number }).statusCode)
          : 0;
      if (status === 404 || status === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
        removed += 1;
      }
    }
  }

  await writeDedupYmd(today);

  return {
    ok: true,
    tomorrowCount: due.length,
    sent,
    failed,
    removed,
  };
}
