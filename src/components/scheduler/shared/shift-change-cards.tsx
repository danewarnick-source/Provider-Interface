// "Your shift changed" cards on the staff phone's My Schedule (B4): one card
// per shift the office changed and sent (listMyShiftChanges), e.g. "Your Thu
// shift changed · 3p–11p → 4p–11p at Maple House", or Cancelled / Removed /
// New. Got it records the acknowledgement (ackShiftChange) and the card leaves.
// Rendered by routes/dashboard.schedule.tsx.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ackShiftChange, listMyShiftChanges } from "@/lib/scheduler/shift-change.functions";

const TAG = {
  changed: { label: "Changed", cls: "bg-[var(--hive-gold-soft)] text-[var(--hive-text)]" },
  new: { label: "New", cls: "bg-[var(--hive-ok-soft)] text-[var(--hive-ok)]" },
  removed: {
    label: "Removed",
    cls: "bg-[var(--hive-muted-surface)] text-[var(--hive-text-muted)]",
  },
  cancelled: { label: "Cancelled", cls: "bg-[var(--hive-danger-soft)] text-[var(--hive-danger)]" },
};

export function ShiftChangeCards({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listMyShiftChanges);
  const ack = useServerFn(ackShiftChange);
  const key = ["my-shift-changes", organizationId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { organization_id: organizationId } }),
  });
  const got = useMutation({
    mutationFn: (ids: string[]) =>
      ack({ data: { organization_id: organizationId, change_ids: ids } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!q.data?.length) return null;
  return (
    <section aria-label="Changes to your schedule" className="space-y-2">
      {q.data.map((c) => (
        <div
          key={c.shiftId}
          className="flex items-center gap-3 rounded-lg border border-[var(--hive-gold)] bg-[var(--hive-surface)] p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG[c.kind].cls}`}
              >
                {TAG[c.kind].label}
              </span>
              <span className="truncate text-sm font-semibold">{c.title}</span>
            </div>
            <div className="mt-1 text-sm text-[var(--hive-text-muted)]">{c.detail}</div>
          </div>
          <Button
            className="min-h-11"
            disabled={got.isPending && got.variables === c.changeIds}
            onClick={() => got.mutate(c.changeIds)}
          >
            Got it
          </Button>
        </div>
      ))}
    </section>
  );
}
