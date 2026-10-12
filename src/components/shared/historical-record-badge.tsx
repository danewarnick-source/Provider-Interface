import { Archive } from "lucide-react";

/** Neutral, permanent label for any record with import_source ===
 *  'historical_import' — a fact about provenance, not a warning, so it never
 *  uses red/amber. Shown whether the record is still awaiting confirmation
 *  or already attested. */
export function HistoricalRecordBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Imported from a historical spreadsheet — this did not happen live in PI."
      className={`inline-flex items-center gap-1 rounded-full border border-haze-300 bg-haze-100 px-1.5 py-0.5 text-[10px] font-medium text-haze-600 dark:border-haze-600 dark:bg-haze-800 dark:text-haze-300 ${className}`}
    >
      <Archive className="h-3 w-3" />
      Historical
    </span>
  );
}
