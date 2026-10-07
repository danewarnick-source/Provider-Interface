// The PCSP reader's issues at the top of the review, grouped: "Fix before
// confirming" (errors) and "Check these" (warnings and notes), by page.
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { Issue } from "@/lib/clients/pcsp/parser-shared";
import { checkGroups } from "@/lib/clients/pcsp/review";

const ICON = {
  error: (
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Must fix" />
  ),
  warn: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hive-ink" aria-label="Check" />,
  info: <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Note" />,
};

function Group({ title, issues, tone }: { title: string; issues: Issue[]; tone: string }) {
  if (!issues.length) return null;
  return (
    <div className={`space-y-1 rounded-xl border px-3 py-2 ${tone}`}>
      <p className="text-sm font-semibold text-hive-ink">
        {title} ({issues.length})
      </p>
      <ul className="space-y-1 text-xs">
        {issues.map((i, n) => (
          <li key={n} className="flex items-start gap-1.5">
            {ICON[i.level]}
            <span>
              {i.page && !i.message.startsWith(`Page ${i.page} `) ? (
                <span className="mr-1 font-medium">Page {i.page}:</span>
              ) : null}
              {i.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PcspReviewChecks({ issues }: { issues: readonly Issue[] }) {
  const { fix, check } = checkGroups(issues);
  if (!fix.length && !check.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Nothing to check: everything matched the usual layout.
      </p>
    );
  }
  return (
    <section className="space-y-2" data-testid="pcsp-review-checks">
      <Group
        title="Fix before confirming"
        issues={fix}
        tone="border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)]"
      />
      <Group title="Check these" issues={check} tone="border-hive-gold/50 bg-hive-gold-soft" />
    </section>
  );
}
