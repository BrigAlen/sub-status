# Web Push — «Завтра оплата»

## Env на Render

Сгенерировать ключи:

```bash
npx web-push generate-vapid-keys
```

Задать в Environment:

| Variable | Notes |
|---|---|
| `VAPID_PUBLIC_KEY` | public key |
| `VAPID_PRIVATE_KEY` | private key (только сервер) |
| `VAPID_SUBJECT` | `mailto:you@example.com` или `https://your.app` |
| `CRON_SECRET` | общий секрет для cron (Bearer) |
| `APP_TZ` / `NEXT_PUBLIC_APP_TZ` | по умолчанию `Europe/Moscow` — день «завтра» считается в этой зоне |

`render.yaml` уже перечисляет `VAPID_*`.

## В приложении

1. Установите PWA на телефон (см. ниже).
2. **Настройки → Web Push напоминания → Включить**.
3. Разрешите уведомления браузеру.

Подписка хранится в таблице `push_subscriptions`.

## Cron (ежедневно)

Один из вариантов (оба требуют `Authorization: Bearer $CRON_SECRET`):

- `GET|POST /api/cron/calendar-reminders` — Google Calendar sync **и** push «завтра оплата»
- `GET|POST /api/cron/payment-reminders` — только push (`?force=1` чтобы обойти дневной дедуп)

На Render: Cron Job → URL сервиса + путь, заголовок Authorization, раз в сутки утром (например 08:00 Europe/Moscow).

Логика: активные подписки с `nextBillingAt` = завтра → уведомление с заголовком **«Завтра оплата»**. Один batch на календарный день (`app_settings.push_reminders_last_ymd`).

## PWA install

### Android (Chrome)

1. Откройте HTTPS URL на Render в Chrome.
2. Меню ⋮ → **Установить приложение** / **На экран «Домой»**.
3. Или баннер «Установить», если браузер его показал.
4. Зайдите в установленное приложение → Настройки → включите Push.

### iOS (Safari, 16.4+)

1. Откройте сайт в **Safari** (не в Chrome).
2. Поделиться → **На экран «Домой»**.
3. Откройте иконку с домашнего экрана (standalone).
4. Настройки → включите Push и разрешите уведомления.
5. Без установки на Home Screen Web Push на iOS не работает.

### Desktop

Chrome/Edge: установить PWA из адресной строки (иконка монитора) или меню → Установить. Затем включить Push в Настройках.
