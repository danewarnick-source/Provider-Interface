// The pill row under the client's name: each active code as a white
// outlined pill, then readiness ("Ready to schedule" or "N to fix" with the
// reasons in a tooltip), or the discharge date once discharged.

import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { HeaderReadiness } from "@/lib/clients/profile-header";

export function HeaderPills({
  codes,
  readiness,
  discharged,
}: {
  codes: string[];
  readiness: HeaderReadiness | null;
  /** "Discharged Aug 31, 2026" when discharged; null when active. */
  discharged: string | null;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {codes.map((c) => (
        <span
          key={c}
          className="inline-flex items-center rounded-full border border-hive-border bg-hive-surface px-2.5 py-0.5 font-mono text-xs font-semibold text-hive-ink"
          data-testid="client-profile-code"
        >
          {c}
        </span>
      ))}
      {codes.length === 0 && !discharged ? <StatusTag tone="danger">No codes</StatusTag> : null}
      {discharged ? (
        <StatusTag testId="client-profile-status">{discharged}</StatusTag>
      ) : readiness ? (
        readiness.ready ? (
          <StatusTag tone="ok" testId="client-profile-readiness">
            Ready to schedule
          </StatusTag>
        ) : (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${readiness.missing.length} to fix: ${readiness.missing.join("; ")}`}
                >
                  <StatusTag tone="danger" testId="client-profile-readiness">
                    {readiness.missing.length} to fix
                  </StatusTag>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <ul className="list-disc space-y-0.5 pl-4 text-xs">
                  {readiness.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      ) : null}
    </div>
  );
}
