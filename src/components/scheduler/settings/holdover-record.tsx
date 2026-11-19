// Settings › Open shifts › Hold-over record: every team member, next up first
// (never held over, then longest ago, then fewest this month), with when they
// last stayed, why, and how many times this month (loadHoldoverRecord,
// holdover.functions.ts). The ladder asks people to stay in this order.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDate } from "@/lib/clients/dates";
import { loadHoldoverRecord } from "@/lib/scheduler/holdover.functions";
import { dayKey } from "@/lib/scheduler/time";

export function HoldoverRecord({ orgId }: { orgId: string }) {
  const load = useServerFn(loadHoldoverRecord);
  const q = useQuery({
    queryKey: ["holdover-record", orgId],
    queryFn: () => load({ data: { organization_id: orgId } }),
  });
  if (q.isLoading) return <p className="py-3 text-sm text-muted-foreground">Loading…</p>;
  if (q.error)
    return (
      <p className="py-3 text-sm text-[var(--hive-danger)]">
        The hold-over record didn't load. Reload the page.
      </p>
    );
  const list = q.data ?? [];
  if (!list.length)
    return <p className="py-3 text-sm text-muted-foreground">No team members yet.</p>;
  return (
    <div className="mt-2">
      <div className="hidden grid-cols-[64px_1fr_1fr_96px] gap-2 border-b border-[var(--hive-border)] pb-1 text-xs font-semibold text-muted-foreground sm:grid">
        <span>Next up</span>
        <span>Team member</span>
        <span>Last held over</span>
        <span className="text-right">This month</span>
      </div>
      <ol>
        {list.map((r, i) => (
          <li
            key={r.staffId}
            className="grid grid-cols-[40px_1fr] gap-x-2 border-b border-[var(--hive-border)] py-2 text-sm last:border-b-0 sm:grid-cols-[64px_1fr_1fr_96px]"
          >
            <span className="tabular-nums">{i + 1}</span>
            <b>{r.name}</b>
            <span className="col-start-2 text-muted-foreground sm:col-start-auto sm:text-[var(--hive-text)]">
              {r.last ? formatDate(dayKey(r.last)) : "Never"}
              {r.lastReason && (
                <span className="block text-xs text-muted-foreground">{r.lastReason}</span>
              )}
            </span>
            <span className="col-start-2 tabular-nums text-muted-foreground sm:col-start-auto sm:text-right sm:text-[var(--hive-text)]">
              <span className="sm:hidden">This month: </span>
              {r.month}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
