import { providerLabel } from "@/lib/format";

type Props = {
  provider: string;
  name: string;
  usedPercent: number | null;
  remainingText: string | null;
  resetsAt: string | null;
  label: string;
  stubNote?: string;
};

export function LimitCard({
  provider,
  name,
  usedPercent,
  remainingText,
  resetsAt,
  label,
  stubNote,
}: Props) {
  const pct = usedPercent ?? 0;
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {providerLabel(provider)}
          </p>
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-semibold tabular-nums dark:bg-zinc-800">
          {usedPercent != null ? pct.toFixed(0) + "%" : "—"}
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={"h-full rounded-full transition-all " + color}
          style={{ width: Math.min(100, pct) + "%" }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{remainingText || "нет данных"}</span>
        <span>
          сброс:{" "}
          {resetsAt
            ? new Date(resetsAt).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
      </div>
      {stubNote ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {stubNote}
        </p>
      ) : null}
    </div>
  );
}
