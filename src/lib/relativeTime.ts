const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.34524, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** e.g. "3 days ago", "just now", "in 2 hours". */
export function relativeTime(from: Date | string, now: Date = new Date()): string {
  const date = typeof from === "string" ? new Date(from) : from;
  let duration = (date.getTime() - now.getTime()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), "years");
}

/** "Today" / "Yesterday" / weekday / "31 Aug 2026" — for grouping activity feeds. */
export function dayLabel(value: Date | string, now: Date = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** e.g. "31 Aug 2026, 14:05". */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
