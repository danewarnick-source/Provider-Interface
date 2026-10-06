// Add a plan year or edit its dates (start, end, activation, PCSP meeting).
// Saving re-checks the team's duties for this client, since plan dates
// drive PCSP-related obligations.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addClientPlan, updateClientPlanDates } from "@/lib/clients/plans.functions";
import type { ClientPlan } from "@/lib/clients/plans";
import { onClientDutyFactsChanged } from "@/lib/staff-assignment-hooks.functions";
import { LabeledInput } from "@/components/clients/profile/cards/card-shell";
import { clientPlansKey } from "@/components/clients/shared/hooks/use-plan-goals";

type Dates = { start_date: string; end_date: string; activated_on: string; meeting_date: string };

const FIELDS: { key: keyof Dates; label: string }[] = [
  { key: "start_date", label: "Plan year starts" },
  { key: "end_date", label: "Plan year ends" },
  { key: "activated_on", label: "Activated on (support strategies due 30 days later)" },
  { key: "meeting_date", label: "PCSP meeting" },
];

export function PlanDatesDialog({
  orgId,
  clientId,
  plan,
  onClose,
}: {
  orgId: string;
  clientId: string;
  /** null adds a new plan year. */
  plan: ClientPlan | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const addFn = useServerFn(addClientPlan);
  const updateFn = useServerFn(updateClientPlanDates);
  const dutyFactsFn = useServerFn(onClientDutyFactsChanged);
  const [dates, setDates] = useState<Dates>({
    start_date: plan?.start_date ?? "",
    end_date: plan?.end_date ?? "",
    activated_on: plan?.activated_on ?? "",
    meeting_date: plan?.meeting_date ?? "",
  });
  const problem =
    dates.start_date && dates.end_date && dates.end_date < dates.start_date
      ? "The plan year can't end before it starts."
      : !plan && !dates.start_date
        ? "Add the start date."
        : null;
  const save = useMutation({
    mutationFn: async () => {
      const values = {
        organizationId: orgId,
        clientId,
        start_date: dates.start_date || null,
        end_date: dates.end_date || null,
        activated_on: dates.activated_on || null,
        meeting_date: dates.meeting_date || null,
      };
      if (plan) await updateFn({ data: { ...values, planId: plan.id } });
      else await addFn({ data: values });
      try {
        await dutyFactsFn({ data: { organizationId: orgId, clientId } });
      } catch (e) {
        console.warn("[obligations] client duty reevaluate failed:", e);
      }
    },
    onSuccess: () => {
      toast.success(plan ? "Plan dates saved." : "Plan year added.");
      void qc.invalidateQueries({ queryKey: clientPlansKey(clientId) });
      void qc.invalidateQueries({ queryKey: ["client-profile"] });
      void qc.invalidateQueries({ queryKey: ["client-overview"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? "Plan year dates" : "Add a plan year"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3" data-testid="plan-dates-form">
          {FIELDS.map((f) => (
            <LabeledInput
              key={f.key}
              label={f.label}
              type="date"
              value={dates[f.key]}
              onChange={(v) => setDates((d) => ({ ...d, [f.key]: v }))}
            />
          ))}
        </div>
        {problem ? <p className="text-xs text-amber-700">{problem}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending || !!problem} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
