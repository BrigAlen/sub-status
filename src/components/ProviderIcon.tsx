type Props = {
  provider: string;
  className?: string;
  size?: number;
};

function CursorMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill="#000000" />
      <path
        fill="#ffffff"
        d="M9.2 7.4c-.5-.3-1.1.1-1 .7l2.2 14.2c.1.6.9.8 1.3.3l3.2-3.6 3.1 5.4c.3.5 1 .6 1.4.3l2.1-1.2c.5-.3.6-1 .3-1.4l-3.1-5.4 4.6-1.1c.6-.1.8-.9.3-1.3L9.2 7.4z"
      />
    </svg>
  );
}

function ClaudeMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill="#D97757" />
      <path
        fill="#ffffff"
        d="M16 6.5l1.1 6.2 6.2 1.1-6.2 1.1L16 21.1l-1.1-6.2-6.2-1.1 6.2-1.1L16 6.5zm7.2 11.8l.6 3.2 3.2.6-3.2.6-.6 3.2-.6-3.2-3.2-.6 3.2-.6.6-3.2zM8.2 19.2l.45 2.4 2.4.45-2.4.45-.45 2.4-.45-2.4-2.4-.45 2.4-.45.45-2.4z"
      />
    </svg>
  );
}

function GoogleMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill="#ffffff" stroke="#e4e4e7" />
      <path
        fill="#4285F4"
        d="M26.5 16.3c0-.7-.1-1.4-.2-2H16v3.8h5.9c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.4-5 3.4-8z"
      />
      <path
        fill="#34A853"
        d="M16 27c3.1 0 5.7-1 7.6-2.7l-3.7-2.8c-1 .7-2.4 1.2-3.9 1.2-3 0-5.5-2-6.4-4.7H5.8v2.9C7.7 24.6 11.6 27 16 27z"
      />
      <path
        fill="#FBBC05"
        d="M9.6 18c-.2-.7-.4-1.4-.4-2s.1-1.3.4-2V11H5.8C5.1 12.5 4.7 14.2 4.7 16s.4 3.5 1.1 5l3.8-3z"
      />
      <path
        fill="#EA4335"
        d="M16 9.3c1.7 0 3.2.6 4.4 1.7l3.3-3.3C21.7 5.8 19.1 4.7 16 4.7 11.6 4.7 7.7 7.1 5.8 11l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z"
      />
    </svg>
  );
}

function YandexMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill="#FC3F1D" />
      <text
        x="16"
        y="17"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
        fontSize="16"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        Я
      </text>
    </svg>
  );
}

function AppleMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill="#111111" />
      <path
        fill="#f5f5f7"
        d="M20.6 10.2c-.9.5-1.9.8-2.9.7-.1-1 .4-2.1 1-2.8.7-.8 1.9-1.4 2.9-1.4.1 1.1-.3 2.1-1 3.5zm2.6 9.1c-.5 1.1-.7 1.6-1.4 2.6-.9 1.3-2.1 2.9-3.7 2.9-1.4 0-1.8-.9-3.4-.9-1.6 0-2.1.9-3.4.9-1.5 0-2.7-1.4-3.6-2.8-2-3.1-2.2-6.7-1-8.6.9-1.4 2.3-2.3 3.9-2.3 1.5 0 2.4.9 3.6.9 1.1 0 2.2-1.1 3.9-.9 1.5.1 2.7.8 3.5 2-.1.1-2.1 1.2-2.1 3.6 0 2.9 2.5 3.8 2.7 3.9z"
      />
    </svg>
  );
}


function MullvadMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill="#FFCC00" />
      {/* Decorative Mullvad-style yellow/black mark (not an official trademark asset). */}
      <circle cx="16" cy="15" r="8.2" fill="#111111" />
      <path
        fill="#FFCC00"
        d="M16 9.2c-1.6 0-2.9 1.1-2.9 2.9 0 1.3.7 2.3 1.7 2.8v1.6h2.4v-1.6c1-.5 1.7-1.5 1.7-2.8 0-1.8-1.3-2.9-2.9-2.9zm0 1.6c.7 0 1.3.5 1.3 1.3S16.7 13.4 16 13.4s-1.3-.5-1.3-1.3.6-1.3 1.3-1.3z"
      />
      <rect x="13.6" y="16.2" width="4.8" height="5.4" rx="1.2" fill="#FFCC00" />
      <rect x="14.7" y="17.4" width="2.6" height="2.2" rx="0.6" fill="#111111" />
    </svg>
  );
}

function LetterMark({
  size,
  className,
  bg,
  fg,
  letter,
}: {
  size: number;
  className: string;
  bg: string;
  fg: string;
  letter: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={"shrink-0 rounded-lg " + className}
      aria-hidden
      role="img"
    >
      <rect width="32" height="32" rx="8" fill={bg} />
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fill={fg}
        fontSize="15"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {letter}
      </text>
    </svg>
  );
}

/** Brand-style marks for dashboard cards (decorative, not official trademark assets). */
export function ProviderIcon({ provider, className = "", size = 28 }: Props) {
  if (provider === "cursor") return <CursorMark size={size} className={className} />;
  if (provider === "claude") return <ClaudeMark size={size} className={className} />;
  if (provider === "google") return <GoogleMark size={size} className={className} />;
  if (provider === "yandex") return <YandexMark size={size} className={className} />;
  if (provider === "apple") return <AppleMark size={size} className={className} />;
  if (provider === "mullvad") return <MullvadMark size={size} className={className} />;
  if (provider === "boosty")
    return (
      <LetterMark
        size={size}
        className={className}
        bg="#f36c25"
        fg="#ffffff"
        letter="B"
      />
    );
  return (
    <LetterMark size={size} className={className} bg="#71717a" fg="#ffffff" letter="?" />
  );
}