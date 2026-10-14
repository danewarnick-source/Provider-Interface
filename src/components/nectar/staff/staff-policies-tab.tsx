// Team member Nectar's Policies tab (N6, Decision 4, as in the demo): every
// published policy and procedure meant for them, each "Needs review · vN" or
// "Reviewed Oct 3 · vN". A new version asks them again.

import { policiesSummary, policyStatus } from "@/lib/nectar/library/staff-policies";
import { cn } from "@/lib/utils";
import { StaffError, StaffLoading, StaffScroll } from "./staff-parts";
import { useMyPolicies } from "./use-staff-policies";

export function StaffPoliciesTab({
  orgId,
  onOpen,
}: {
  orgId: string | null;
  onOpen: (documentId: string) => void;
}) {
  const q = useMyPolicies(orgId);
  return (
    <StaffScroll>
      {q.isLoading || !orgId ? (
        <StaffLoading />
      ) : q.error || !q.data ? (
        <StaffError error={q.error} fallback="Could not load your policies. Try again." />
      ) : (
        <div className="space-y-2.5">
          <p className="text-sm text-muted-foreground">{policiesSummary(q.data.policies)}</p>
          <ul className="space-y-2">
            {q.data.policies.map((p) => {
              const status = policyStatus(p);
              return (
                <li key={p.documentId}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.documentId)}
                    className="flex w-full flex-col items-start gap-1.5 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition hover:border-[var(--hive-gold)]/50 active:scale-[0.99]"
                  >
                    <span className="font-semibold text-[var(--hive-text)]">{p.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        status.tone === "ok"
                          ? "bg-[var(--hive-ok-soft)] text-[var(--hive-ok-fg)]"
                          : "bg-amber-100 text-amber-900",
                      )}
                    >
                      {status.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </StaffScroll>
  );
}
