export type UsageWindow = {
  label: string;
  usedPercent: number | null;
  remainingText: string | null;
  resetsAt: Date | null;
};

/** Real billing fields extracted from provider API — never invent prices. */
export type ProviderBilling = {
  name?: string;
  amountCents?: number | null;
  currency?: string;
  nextBillingAt?: string | null; // YYYY-MM-DD
  billingPeriod?: string;
};

export type ProviderFetchResult = {
  provider: "cursor" | "claude";
  windows: UsageWindow[];
  raw: unknown;
  error?: string;
  billing?: ProviderBilling;
};

export type ClaudeTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type CursorSecret = {
  sessionToken: string;
};
