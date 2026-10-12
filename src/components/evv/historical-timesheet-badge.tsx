import { Archive } from "lucide-react";

/** Renders a permanent visual marker for timesheet rows imported from a
 *  historical spreadsheet (import_source === 'historical_import'). Never
 *  appears on live clock punches. */
export function HistoricalTimesheetBadge({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const cls =
    size === "md"
      ? "text-xs px-2 py-0.5"
      : "text-[10px] px-1.5 py-0.5";
  return (
    <span
      title="Imported from a historical spreadsheet — this did not happen live in PI."
      className={`inline-flex items-center gap-1 rounded-full border border-pt2 bg-pt font-medium uppercase tracking-wider text-pri ${cls} ${className}`}
    >
      <Archive className="h-3 w-3" />
      Historical import
    </span>
  );
}
