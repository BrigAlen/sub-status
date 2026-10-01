# Статус подписок (Sub Status)

Веб-приложение для отслеживания **лимитов использования** (Cursor, Claude — это подписки, не API-ключи) и **оплат** других сервисов (Google, Яндекс, Boosty и т.д.).

Стек: **Next.js 15 (App Router) + TypeScript + Tailwind + Drizzle ORM + Neon Postgres**.

Готово к деплою на **Render** + **Neon**. Облачные ресурсы этим репозиторием **не создаются** — только код и документация.

## Возможности

- Дашборд: секции «Лимиты» и «Оплаты» (UI на русском)
- CRUD подписок (`/subscriptions`, REST `/api/subscriptions`)
- Заглушки usage для Cursor / Claude (+ таблица `usage_snapshots`)
- PWA: manifest, иконки, service worker stub (Web Push позже)
- Безопасность:
  - сессия iron-session (HttpOnly, Secure в prod, SameSite=lax)
  - CSRF double-submit на мутациях (`x-csrf-token`)
  - rate limit (in-memory) на login и API
  - security headers + CSP (middleware)
  - zod-валидация входов
  - Drizzle / parameterized SQL
  - AES-256-GCM для секретов провайдеров (`ENCRYPTION_KEY`)
  - `audit_logs` для login и изменений подписок
  - VAPID public key только через API; private — только на сервере

## Быстрый старт (Windows / PowerShell)

```powershell
cd D:\work\sub-status
Copy-Item .env.example .env.local   # или используйте уже созданный .env.local
npm install
npm run dev
```

Откройте http://localhost:3000

Без `DATABASE_URL` и с `ALLOW_MOCK_DATA=true` UI показывает **демо-данные**. CRUD и шифрование секретов требуют Neon.

### Переменные окружения

См. `.env.example`:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `AUTH_SECRET` | ≥32 символов, шифрование cookie-сессии |
| `APP_PASSWORD` | Пароль входа (в prod обязателен) |
| `ENCRYPTION_KEY` | 64 hex-символа (32 байта) для AES-GCM |
| `NEXT_PUBLIC_APP_URL` | Публичный URL (build-time для клиента) |
| `APP_URL` | Server runtime URL (предпочтительно для Google OAuth `redirect_uri`; на Render = публичный URL) |
| `APP_TZ` / `NEXT_PUBLIC_APP_TZ` | Часовой пояс отображения дат (по умолчанию `Europe/Moscow`) |
| `VAPID_*` | Web Push (`npx web-push generate-vapid-keys`) |
| `ALLOW_MOCK_DATA` | `true` — демо без БД (только non-production) |

В production **обязательны** `APP_PASSWORD`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`.

Сгенерировать `ENCRYPTION_KEY`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## База данных (Neon)

1. Создайте проект Neon вручную, скопируйте connection string в `DATABASE_URL`.
2. Примените схему:

```powershell
# psql $env:DATABASE_URL -f db/migrations/0000_init.sql
# или
npm run db:push
```

3. Сид:

```powershell
npm run db:seed
```

Таблицы: `subscriptions`, `usage_snapshots`, `push_subscriptions`, `provider_credentials`, `audit_logs`.

## Auth

- Страница `/login`, cookie `sub_status_session`
- Middleware закрывает страницы и API (кроме публичных ассетов / login)
- Без `APP_PASSWORD` в non-prod + `ALLOW_MOCK_DATA` — open-dev (удобно локально)
- Полноценный multi-user auth — позже

## Render + Neon

1. Подключите Git-репозиторий к Render (Web Service, Node).
2. Build: `npm install && npm run build`, Start: `npm start`
3. Задайте env из `.env.example` (см. также `render.yaml` stub).
4. На Neon выполните миграцию + seed.
5. `NEXT_PUBLIC_APP_URL` и `APP_URL` = URL сервиса Render (https), например `https://sub-status.onrender.com`. `APP_URL` нужен для Google OAuth на runtime (NEXT_PUBLIC_* вшивается на build). После смены URL — Clear build cache и redeploy.

**Не коммитьте** `.env.local` и секреты.

## Структура

```
src/app/           # страницы и API routes
src/components/    # UI
src/db/            # schema, client, mock
src/lib/           # session, csrf, crypto, rate-limit, audit, validation
src/providers/     # stub Cursor/Claude usage
db/migrations/     # SQL
db/seed.ts
public/            # PWA manifest, sw.js, icons
```

## API (кратко)

- `POST /api/auth/login` — вход (rate limit)
- `POST /api/auth/logout` — выход (+ CSRF)
- `GET /api/csrf` — CSRF-токен
- `GET|POST /api/subscriptions` — список / создание
- `GET|PATCH|DELETE /api/subscriptions/[id]`
- `GET /api/usage` — снимки usage
- `POST /api/credentials` — сохранить секрет провайдера (шифруется)
- `POST /api/push/subscribe` — stub Web Push
- `GET /api/push/vapid-public` — только public key

## Безопасность — заметки

- Секреты провайдеров **никогда** не отдаются клиенту (только metadata).
- Rate limit in-memory: на Render free при нескольких инстансах нужен Redis.
- CSP допускает `unsafe-inline`/`unsafe-eval` из‑за Next.js — ужесточить позже (nonces).
- Пароль сейчас сравнивается timing-safe с env; позже — bcrypt-hash в env.

## Лицензия

Private / личное использование.
