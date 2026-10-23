// Goals and supports: the current plan year's goals → supports → codes
// (plus "Other needs in the PCSP"). Editors get one ⋯ menu per goal (Edit /
// End goal), one per support (Edit / End support) and "Add support" under
// each goal's supports; "View as" a code (what a team member working that code sees).
// Nothing is deleted: goals are ended, supports get an end date.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { FieldVisibilityToggle } from "@/components/clients/profile/visibility-toggles";
import { clientPlansKey, useClientPlans } from "@/components/clients/shared/hooks/use-plan-goals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayYmd } from "@/lib/clients/dates";
import { currentPlan, goalView, supportsForCode, type GoalView } from "@/lib/clients/plans/plans";
import { addClientPlan, endClientGoal, endGoalSupport } from "@/lib/clients/plans/plans.functions";
import { GoalTree } from "./goal-tree";
import { PLAN_CARD } from "./support-lines";
import { GoalDialog, SupportDialog } from "./goal-dialogs";

type Support = GoalView["supports"][number];

export function PlanGoalsPanel({
  clientId,
  orgId,
  codes,
  canEdit,
}: {
  clientId: string;
  orgId?: string;
  codes: string[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const plansQ = useClientPlans(clientId);
  const addPlanFn = useServerFn(addClientPlan);
  const endGoalFn = useServerFn(endClientGoal);
  const endSupportFn = useServerFn(endGoalSupport);
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
    <SectionCard
      icon={Target}
      tone="ok"
      title="Goals and supports"
      className={PLAN_CARD}
      description="This plan year's PCSP goals and the supports for each. View as a code to see what a team member on it sees."
      actions={
        <>
          <Select value={viewAs} onValueChange={setViewAs}>
            <SelectTrigger className="h-10 w-44" aria-label="View as" data-testid="plan-view-as">
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
          {canEdit ? (
            <Button type="button" variant="outline" disabled={!scope} onClick={act(async () => {
              const planId = await ensurePlanId();
              if (planId) setGoalDlg({ goal: null, planId });
            })}>
              <Plus className="h-4 w-4" /> Add goal
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {plansQ.isLoading ? (
          <p className="text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Loading…</p>
        ) : (
          <GoalTree
            goals={goals}
            empty={viewAs === "all" ? "No goals yet — upload the PCSP or add them." : `No supports list ${viewAs} — a team member working ${viewAs} sees no goals.`}
            goalActions={!canEdit ? undefined : (g) => (
              <div className="flex shrink-0 items-center gap-2">
                <FieldVisibilityToggle clientId={clientId} section="care_plan" kind="goal" id={g.id} label="this goal" />
                <RowMenu
                  label="Goal actions"
                  items={[
                    { label: "Edit goal", disabled: !plan, onSelect: () => plan && setGoalDlg({ goal: g, planId: plan.id }) },
                    { label: "End goal", danger: true, disabled: !scope, onSelect: act(() => endGoalFn({ data: { ...scope!, goalId: g.id } })) },
                  ]}
                />
              </div>
            )}
            supportActions={!canEdit ? undefined : (g, s) => (
              <RowMenu
                label="Support actions"
                items={[
                  { label: "Edit support", onSelect: () => setSupportDlg({ goal: g, support: s }) },
                  { label: "End support", danger: true, disabled: !scope, onSelect: act(() => endSupportFn({ data: { ...scope!, goalId: g.id, supportId: s.id } })) },
                ]}
              />
            )}
            addSupport={!canEdit ? undefined : (g) => (
              <Button type="button" variant="outline" onClick={() => setSupportDlg({ goal: g, support: null })}>
                <Plus className="h-4 w-4" /> Add support
              </Button>
            )}
          />
        )}
      </div>
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
    </SectionCard>
  );
}

