import type { SVGProps } from "react";

type Code = "EUR" | "USD" | "BYN";

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

/** Outline currency glyphs for EUR (€), USD ($), BYN (Br). */
export function CurrencyIcon({
  code,
  className = "size-4 shrink-0",
}: {
  code: Code | string;
  className?: string;
}) {
  if (code === "EUR") {
    return (
      <svg {...base} className={className}>
        <path d="M16.2 7.1a5.4 5.4 0 1 0 0 9.8" />
        <path d="M7.5 10.4h7.2M7.5 13.6h6.2" />
      </svg>
    );
  }
  if (code === "USD") {
    return (
      <svg {...base} className={className}>
        <path d="M12 4.5v15" />
        <path d="M15.4 8.1c-.5-1.5-1.85-2.35-3.55-2.35-2.1 0-3.55 1.15-3.55 2.75 0 1.5 1.05 2.3 3.35 2.8l.55.12c2.25.5 3.5 1.3 3.5 3.05 0 1.85-1.6 3.15-3.95 3.15-1.9 0-3.4-.9-4-2.45" />
      </svg>
    );
  }
  // BYN — outline letters Br
  return (
    <svg {...base} className={className}>
      <path d="M5.2 5.5v13" />
      <path d="M5.2 5.5h4.1c2.15 0 3.55 1.2 3.55 3.05 0 1.45-.95 2.5-2.5 2.85" />
      <path d="M5.2 11.4h4.55c2.35 0 3.9 1.25 3.9 3.25 0 2.05-1.65 3.4-4.2 3.4H5.2" />
      <path d="M16.4 12.6v5.9" />
      <path d="M16.4 12.6c.85-.55 1.7-.8 2.55-.8 1.55 0 2.55.95 2.55 2.45v4.25" />
    </svg>
  );
}

export const CURRENCY_OPTIONS: { code: Code; label: string }[] = [
  { code: "EUR", label: "EUR" },
  { code: "USD", label: "USD" },
  { code: "BYN", label: "BYN" },
];
