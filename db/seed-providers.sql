-- Optional Neon seed when DB is empty (Cursor/Claude/Google/Yandex).
-- Prefer: npm run db:seed
-- Or run this in Neon SQL editor once.

INSERT INTO subscriptions (name, provider, kind, amount_cents, currency, billing_period, next_billing_at, notes, is_active)
SELECT * FROM (VALUES
  ('Cursor Pro', 'cursor', 'both', 2000, 'USD', 'monthly', (CURRENT_DATE + INTERVAL '12 days')::date, 'Seed: Cursor', true),
  ('Claude Pro', 'claude', 'both', 2000, 'USD', 'monthly', (CURRENT_DATE + INTERVAL '5 days')::date, 'Seed: Claude', true),
  ('Google One', 'google', 'billing_only', 29900, 'RUB', 'monthly', (CURRENT_DATE + INTERVAL '18 days')::date, NULL, true),
  ('Яндекс 360', 'yandex', 'billing_only', 39900, 'RUB', 'monthly', (CURRENT_DATE + INTERVAL '22 days')::date, NULL, true),
  ('Apple One', 'apple', 'billing_only', 29900, 'RUB', 'monthly', (CURRENT_DATE + INTERVAL '15 days')::date, 'Seed: Apple (ручной биллинг)', true)
) AS v(name, provider, kind, amount_cents, currency, billing_period, next_billing_at, notes, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.provider = v.provider
);
