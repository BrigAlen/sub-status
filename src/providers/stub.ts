/**
 * Provider stubs for Cursor / Claude usage limits.
 * These are SUBSCRIPTIONS (usage windows), not API keys for LLM calls.
 */

export type ProviderUsageStub = {
  provider: "cursor" | "claude";
  label: string;
  usedPercent: number;
  remainingText: string;
  resetsAt: string | null;
  note: string;
};

export function stubCursorUsage(): ProviderUsageStub {
  return {
    provider: "cursor",
    label: "cursor pool",
    usedPercent: 68,
    remainingText: "~32% пула",
    resetsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    note: "Заглушка: живой Cursor usage появится после OAuth/cookie-интеграции",
  };
}

export function stubClaudeUsage(): ProviderUsageStub {
  return {
    provider: "claude",
    label: "5h window",
    usedPercent: 42,
    remainingText: "осталось ~3ч",
    resetsAt: new Date(Date.now() + 5 * 3600000).toISOString(),
    note: "Заглушка: живой Claude usage появится после интеграции подписки",
  };
}
