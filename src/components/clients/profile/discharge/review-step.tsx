// Discharge step 3: what the discharge will end, before it happens.

import { Loader2 } from "lucide-react";
import { endedLines } from "@/lib/clients/discharge";
import { formatDate } from "@/lib/clients/dates";
import type { DischargePreview } from "@/lib/clients/discharge.functions";

export function ReviewStep({
  preview,
  loading,
  error,
  dischargeDate,
  summaryConfirmed,
}: {
  preview: DischargePreview | undefined;
  loading: boolean;
  error: Error | null;
  dischargeDate: string;
  summaryConfirmed: boolean;
}) {
  return (
    <div className="space-y-3 text-sm" data-testid="discharge-review-step">
      <p>
        On {formatDate(dischargeDate)} the client moves to the Discharged list and their record
        becomes read-only. Nothing is deleted: client records are kept for 7 years.
      </p>
      {loading ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking what this ends…
        </p>
      ) : error ? (
        <p className="text-destructive">{error.message}</p>
      ) : preview ? (
        <ul className="list-disc space-y-1 pl-5" data-testid="discharge-review-list">
          {endedLines(preview.ended).map((line) => (
            <li key={line}>{line}</li>
          ))}
          {preview.upcoming.length ? (
            <li>
              {preview.upcoming.length} authorization
              {preview.upcoming.length === 1 ? " starts" : "s start"} after the discharge date and
              {preview.upcoming.length === 1 ? " is" : " are"} left as{" "}
              {preview.upcoming.length === 1 ? "it is" : "they are"} (
              {preview.upcoming.map((u) => u.service_code).join(", ")}).
            </li>
          ) : null}
        </ul>
      ) : null}
      <p className="text-muted-foreground">
        {summaryConfirmed
          ? "The discharge summary is confirmed. Mark it sent once it goes out."
          : "The discharge summary is due 7 days after the discharge date. You can finish it on the profile."}
      </p>
    </div>
  );
}
