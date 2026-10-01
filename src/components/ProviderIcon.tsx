type Props = {
  provider: string;
  className?: string;
  size?: number;
};

const COLORS: Record<string, { bg: string; fg: string; letter: string }> = {
  cursor: { bg: "#1a1a1a", fg: "#ffffff", letter: "C" },
  claude: { bg: "#d97757", fg: "#ffffff", letter: "A" },
  google: { bg: "#4285f4", fg: "#ffffff", letter: "G" },
  yandex: { bg: "#fc3f1d", fg: "#ffffff", letter: "Я" },
  boosty: { bg: "#f36c25", fg: "#ffffff", letter: "B" },
  apple: { bg: "#111111", fg: "#f5f5f7", letter: "a" },
  other: { bg: "#71717a", fg: "#ffffff", letter: "?" },
};

/** Stylized lettermark icons — not official brand logos */
export function ProviderIcon({ provider, className = "", size = 28 }: Props) {
  const c = COLORS[provider] ?? COLORS.other!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill={c.bg} />
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.fg}
        fontSize="15"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {c.letter}
      </text>
    </svg>
  );
}
