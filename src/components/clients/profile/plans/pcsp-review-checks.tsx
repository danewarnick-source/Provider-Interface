// "Things to check" from the PCSP reader, errors first, with page numbers.
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { Issue } from "@/lib/clients/pcsp/parser-shared";
import { thingsToCheck } from "@/lib/clients/pcsp/review";

const ICON = {
  error: <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Must fix" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Check" />,
  info: <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Note" />,
};

export function PcspReviewChecks({ issues }: { issues: readonly Issue[] }) {
  const list = thingsToCheck(issues);
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">Things to check ({list.length})</h3>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing to check — everything matched the usual layout.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {list.map((i, n) => (
            <li key={n} className="flex items-start gap-1.5">
              {ICON[i.level]}
              <span>
                {i.page ? <span className="mr-1 font-medium">Page {i.page}:</span> : null}
                {i.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
