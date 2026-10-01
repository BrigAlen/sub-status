export type UsageWindow = {
  label: string;
  usedPercent: number | null;
  remainingText: string | null;
  resetsAt: Date | null;
};

export type ProviderFetchResult = {
  provider: "cursor" | "claude";
  windows: UsageWindow[];
  raw: unknown;
  error?: string;
};

export type ClaudeTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type CursorSecret = {
  sessionToken: string;
};
