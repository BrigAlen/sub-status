/**
 * Fallback notes when live usage is unavailable.
 * These are SUBSCRIPTIONS (usage windows), not API keys for LLM calls.
 */

export type ProviderUsageStub = {
  provider: "cursor" | "claude";
  label: string;
  usedPercent: number | null;
  remainingText: string | null;
  resetsAt: string | null;
  note: string;
};

export function stubCursorUsage(): ProviderUsageStub {
  return {
    provider: "cursor",
    label: "cursor pool",
    usedPercent: null,
    remainingText: null,
    resetsAt: null,
    note: "Нет данных. Сохраните cookie WorkosCursorSessionToken в Настройках и нажмите «Обновить лимиты». Cookie со временем истекает.",
  };
}

export function stubClaudeUsage(): ProviderUsageStub {
  return {
    provider: "claude",
    label: "5ч окно",
    usedPercent: null,
    remainingText: null,
    resetsAt: null,
    note: "Нет данных. Сохраните Claude OAuth (accessToken + refreshToken) в Настройках и нажмите «Обновить лимиты».",
  };
}
