// The board's Needs you banner (B5): "N things need you · 2 call-outs · 1
// claim" with Open Needs you, or "Nothing needs you". Red when any row is red.
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { needsSummary } from "@/lib/scheduler/needs-items";
import { useNeeds } from "./use-needs";

export function NeedsBanner({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useNeeds(orgId);
  if (isLoading) return null;
  if (error)
    return (
      <p className="rounded-lg border border-[var(--hive-border)] px-4 py-3 text-sm text-[var(--hive-danger)]">
        Needs you didn't load: {error.message}. Reload the page to try again.
      </p>
    );
  const items = data ?? [];
  if (!items.length)
    return (
      <div className="rounded-lg border border-[var(--hive-border)] bg-[var(--hive-ok-soft)] px-4 py-3">
        <b className="text-sm">Nothing needs you</b>
        <p className="text-xs text-[var(--hive-text-muted)]">
          New call-outs, claims and requests will show up in Needs you.
        </p>
      </div>
    );
  const crit = items.some((i) => i.level === "crit");
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        crit
          ? "border-[var(--hive-danger)] bg-[var(--hive-danger-soft)]"
          : "border-[var(--hive-gold)] bg-[var(--hive-gold-soft)]"
      }`}
    >
      <div>
        <b className="text-sm">
          {items.length} thing{items.length > 1 ? "s" : ""} need{items.length > 1 ? "" : "s"} you
        </b>
        <p className="text-xs text-[var(--hive-text-muted)]">{needsSummary(items)}</p>
      </div>
      <Button asChild className="min-h-11">
        <Link to="/dashboard/scheduler/needs">Open Needs you</Link>
      </Button>
    </div>
  );
}
