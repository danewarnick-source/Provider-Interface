// "Can you cover?" / "Can you stay?" cards on the staff phone's My Schedule:
// one per escalation ask still waiting on this person (listMyEscalationAsks,
// escalation-staff.functions.ts), e.g. "Can you cover Thu 3p–11p at Maple
// House?" with Take it / Can't, or "Can you stay until 11p?" with Stay until
// 11p / Can't. Take it and Stay go through the rule engine; Can't moves the
// ladder on and the card leaves. Rendered by routes/dashboard.schedule.tsx
// next to the change cards, in the same style.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toastRuleWarnings } from "@/components/scheduler/shared/rule-warnings";
import { fmtClock } from "@/lib/scheduler/board-model";
import {
  answerEscalation,
  listMyEscalationAsks,
  type MyAsk,
} from "@/lib/scheduler/escalation-staff.functions";

export function EscalationAskCards({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listMyEscalationAsks);
  const answerFn = useServerFn(answerEscalation);
  const key = ["my-escalation-asks", organizationId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { organization_id: organizationId } }),
    refetchInterval: 60_000,
  });
  const answer = useMutation({
    mutationFn: (v: { ask: MyAsk; yes: boolean }) =>
      answerFn({
        data: {
          organization_id: organizationId,
          shift_id: v.ask.shiftId,
          answer: v.yes ? "yes" : "no",
        },
      }),
    onSuccess: (r, v) => {
      if (v.yes)
        toast.success(
          v.ask.rung === "holdover" && r.endsAt
            ? `Thanks. Your shift now ends at ${fmtClock(r.endsAt)}`
            : "It's yours",
        );
      toastRuleWarnings(r);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["my-scheduled-shifts"] });
      void qc.invalidateQueries({ queryKey: ["my-shift-changes", organizationId] });
    },
  });
  if (!q.data?.length) return null;
  return (
    <section aria-label="Can you cover?" className="space-y-2">
      {q.data.map((a) => {
        const busy = answer.isPending && answer.variables?.ask.shiftId === a.shiftId;
        return (
          <div
            key={a.shiftId}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--hive-danger)] bg-[var(--hive-surface)] p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--hive-danger-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--hive-danger)]">
                  {a.rung === "holdover" ? "Stay?" : "Urgent"}
                </span>
                <span className="truncate text-sm font-semibold">{a.title}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--hive-text-muted)]">{a.detail}</div>
            </div>
            <div className="flex gap-2">
              <Button
                className="min-h-11"
                disabled={busy}
                onClick={() => answer.mutate({ ask: a, yes: true })}
              >
                {a.yes}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => answer.mutate({ ask: a, yes: false })}
              >
                Can't
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
