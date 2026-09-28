import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { getMemberActivity } from "@/lib/team-members/activity.functions";
import { formatLocalDate } from "@/lib/team-members/badges";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_FILTER_LABEL,
  buildActivityItems,
  filterActivity,
  memberActivityQueryKey,
  type ActivityFilter,
  type ActivityKind,
} from "@/lib/team-members/activity";

const KIND_LABEL: Record<ActivityKind, string> = {
  shift: "Shift",
  form: "Form",
  incident: "Incident",
  account: "Account",
};

const KIND_TONE: Record<ActivityKind, string> = {
  shift: "bg-[var(--hive-ink)]/10 text-[var(--hive-ink)]",
  form: "bg-muted text-foreground/80",
  incident: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  account: "bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300",
};

/** Read-only, newest first. A failed load says so instead of "No activity". */
export function ActivityTab({ orgId, staffId }: { orgId: string; staffId: string }) {
  const fetchFn = useServerFn(getMemberActivity);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const q = useQuery({
    queryKey: memberActivityQueryKey(orgId, staffId),
    queryFn: () => fetchFn({ data: { organizationId: orgId, staffId } }),
  });
  const items = useMemo(() => (q.data ? buildActivityItems(q.data) : []), [q.data]);
  const shown = filterActivity(items, filter);

  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-card p-5"
      data-testid="activity-tab"
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter activity">
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "border-[var(--hive-ink)] bg-[var(--hive-ink)] text-white"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {ACTIVITY_FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading activity…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive" role="alert" data-testid="activity-error">
          Couldn't load activity: {safeErrorMessage(q.error, "please try again.")}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity to show in this filter.</p>
      ) : (
        <ul className="divide-y">
          {shown.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    KIND_TONE[it.kind],
                  )}
                >
                  {KIND_LABEL[it.kind]}
                </span>
                <span className="truncate font-medium">{it.title}</span>
                {it.clientId ? (
                  <Link
                    to="/dashboard/clients/$clientId"
                    params={{ clientId: it.clientId }}
                    className="truncate text-muted-foreground hover:underline"
                  >
                    {it.detail}
                  </Link>
                ) : it.detail ? (
                  <span className="truncate text-muted-foreground">{it.detail}</span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {it.status ? <span className="capitalize">{it.status}</span> : null}
                <span>
                  {it.at.length === 10
                    ? formatLocalDate(it.at)
                    : new Date(it.at).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
