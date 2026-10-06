// Plan goals: the current plan year's goals → supports → codes, with add /
// edit / end and "View as" a code (what a team member working that code
// sees). Nothing is deleted: goals are ended, supports get an end date.
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldVisibilityToggle } from "@/components/clients/profile/visibility-toggles";
import { clientPlansKey, useClientPlans } from "@/components/clients/shared/hooks/use-plan-goals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayYmd } from "@/lib/clients/dates";
import { currentPlan, goalView, supportsForCode, type GoalView } from "@/lib/clients/plans";
import { addClientPlan, endClientGoal, endGoalSupport } from "@/lib/clients/plans.functions";
import { GoalTree } from "./goal-tree";
import { GoalDialog, SupportDialog } from "./goal-dialogs";
import { usePcspImport } from "./use-pcsp-import";
import { PcspReview } from "./pcsp-review";

type Support = GoalView["supports"][number];

export function PlanGoalsPanel({ clientId, orgId, codes }: { clientId: string; orgId?: string; codes: string[] }) {
  const qc = useQueryClient();
  const plansQ = useClientPlans(clientId);
  const addPlanFn = useServerFn(addClientPlan);
  const endGoalFn = useServerFn(endClientGoal);
  const endSupportFn = useServerFn(endGoalSupport);
  const pcsp = usePcspImport(clientId, orgId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [goalDlg, setGoalDlg] = useState<{ goal: GoalView | null; planId: string } | null>(null);
  const [supportDlg, setSupportDlg] = useState<{ goal: GoalView; support: Support | null } | null>(null);
  const [viewAs, setViewAs] = useState("all");

  const plans = plansQ.data?.plans ?? [];
  const plan = currentPlan(plans);
  const today = todayYmd();
  const planGoals = (plansQ.data?.goals ?? []).filter((g) => g.plan_id === plan?.id && g.status === "active");
  const goals =
    viewAs === "all"
      ? planGoals.map((g) => goalView(g, g.supports.filter((s) => !s.end_date || s.end_date >= today)))
      : supportsForCode(planGoals, viewAs, today).map((g) => goalView(g.goal, g.supports));
  const scope = orgId ? { organizationId: orgId, clientId } : null;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: clientPlansKey(clientId) });
    qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
  };
  const act = (work: () => Promise<unknown>) => () => void work().then(refresh, (e: Error) => toast.error(e.message));

  async function ensurePlanId(): Promise<string | null> {
    if (plan) return plan.id;
    if (!scope) return null;
    const { id } = await addPlanFn({ data: scope });
    return id;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Plan goals</CardTitle>
          <Select value={viewAs} onValueChange={setViewAs}>
            <SelectTrigger className="h-8 w-44" aria-label="View as" data-testid="plan-view-as">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">View as: all codes</SelectItem>
              {codes.map((c) => (
                <SelectItem key={c} value={c}>
                  View as: {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,application/pdf"
          data-testid="pcsp-upload-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pcsp.upload(f);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button" size="sm" variant="outline" className="gap-1.5"
            disabled={pcsp.reading || !orgId} onClick={() => fileRef.current?.click()}
          >
            {pcsp.reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            {pcsp.reading ? "Reading the PCSP…" : "Upload new PCSP"}
          </Button>
          <Button type="button" size="sm" className="gap-1.5" disabled={!scope} onClick={act(async () => {
            const planId = await ensurePlanId();
            if (planId) setGoalDlg({ goal: null, planId });
          })}>
            <Plus className="h-3.5 w-3.5" /> Add goal
          </Button>
        </div>
        {plansQ.isLoading ? (
          <p className="text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Loading…</p>
        ) : (
          <GoalTree
            goals={goals}
            empty={viewAs === "all" ? "No goals yet — upload the PCSP or add them." : `No supports list ${viewAs} — a team member working ${viewAs} sees no goals.`}
            goalActions={(g) => (
              <div className="flex shrink-0 items-center gap-0.5">
                <FieldVisibilityToggle clientId={clientId} section="care_plan" kind="goal" id={g.id} label="this goal" />
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Add support" onClick={() => setSupportDlg({ goal: g, support: null })}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit goal" onClick={() => plan && setGoalDlg({ goal: g, planId: plan.id })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-7 w-7" aria-label="End goal" disabled={!scope}
                  onClick={act(() => endGoalFn({ data: { ...scope!, goalId: g.id } }))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            supportActions={(g, s) => (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit support" onClick={() => setSupportDlg({ goal: g, support: s })}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-7 w-7" aria-label="End support" disabled={!scope}
                  onClick={act(() => endSupportFn({ data: { ...scope!, goalId: g.id, supportId: s.id } }))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          />
        )}
      </CardContent>
      {pcsp.read && pcsp.review && (
        <PcspReview
          read={pcsp.read} review={pcsp.review} onChange={pcsp.setReview}
          saving={pcsp.saving} onConfirm={() => void pcsp.confirm()} onClose={pcsp.close}
        />
      )}
      {scope && (
        <>
          {goalDlg && (
            <GoalDialog scope={scope} planId={goalDlg.planId} goal={goalDlg.goal} open onClose={() => setGoalDlg(null)} onSaved={refresh} />
          )}
          <SupportDialog
            scope={scope} goal={supportDlg?.goal ?? null} support={supportDlg?.support ?? null} codes={codes}
            open={!!supportDlg} onClose={() => setSupportDlg(null)} onSaved={refresh}
          />
        </>
      )}
    </Card>
  );
}

