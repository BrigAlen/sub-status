# Google Calendar reminders

1. Create OAuth client (Web) in Google Cloud Console.
2. Authorized redirect: `{NEXT_PUBLIC_APP_URL}/api/google/oauth/callback`
3. Set env on Render: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `CRON_SECRET`.
4. In app: Настройки → «Напоминания в Google Calendar» → Подключить → включить тумблер.
5. Per-subscription: checkbox «Напоминание в Google Calendar» on edit form.
6. Sync: button «Синхронизировать сейчас», or on «Обновить лимиты», or cron `POST /api/cron/calendar-reminders` with `Authorization: Bearer $CRON_SECRET`.
7. `remindOn`: `day_of` (default) or `day_before`.

Apply migration: `db/migrations/0001_calendar.sql`
