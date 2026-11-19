import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { listOpenShifts, claimOpenShift } from "@/lib/scheduler/open-shifts.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toastRuleWarnings } from "@/components/scheduler/shared/rule-warnings";

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * My Schedule's open shifts (dashboard.schedule.tsx): the ones this team
 * member may take, with Request shift. Where the home's pickups are First to
 * claim the shift is theirs at once; otherwise the request waits for an
 * approver in Scheduler › Needs you.
 */
export function OpenShiftsPanel({
  organizationId, startIso, endIso,
}: {
  organizationId: string;
  startIso: string;
  endIso: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const listFn = useServerFn(listOpenShifts);
  const claimFn = useServerFn(claimOpenShift);

  const q = useQuery({
    queryKey: ["open-shifts", organizationId, startIso, endIso],
    queryFn: () => listFn({ data: { organizationId, startIso, endIso } }),
    enabled: !!organizationId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["open-shifts"] });
    qc.invalidateQueries({ queryKey: ["schedule-conflicts"] });
    qc.invalidateQueries({ queryKey: ["shifts-in-range"] });
    qc.invalidateQueries({ queryKey: ["my-scheduled-shifts"] });
    qc.invalidateQueries({ queryKey: ["scheduler-data"] });
  };

  const claim = useMutation({
    mutationFn: (shiftId: string) => claimFn({ data: { shiftId } }),
    onSuccess: (d) => {
      invalidate();
      toast.success(d.assigned ? "Shift picked up. It's on your schedule." : "Requested, waiting for approval");
      toastRuleWarnings(d);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = q.data ?? [];
  if (!rows.length) return null;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold">Open shifts you're qualified for ({rows.length})</h3>
      </div>
      <ul className="space-y-1.5">
        {rows.map((s) => {
          const pending = !!s.claim_requested_by;
          const mine = pending && s.claim_requested_by === user?.id;
          return (
            <li
              key={s.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-2 text-sm md:flex-row md:items-center md:justify-between",
                pending && "border-amber-300 bg-amber-50/60",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {s.service_code ?? "Shift"} · {fmtWhen(s.starts_at)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.status === "open" && !pending && (
                  <Button
                    size="sm"
                    className="h-10 min-h-[44px] md:min-h-0"
                    onClick={() => claim.mutate(s.id)}
                    disabled={claim.isPending}
                  >
                    Request shift
                  </Button>
                )}
                {mine && (
                  <span className="text-[11px] font-medium text-amber-700">
                    Requested, waiting for approval
                  </span>
                )}
                {pending && !mine && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Waiting for approval
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
