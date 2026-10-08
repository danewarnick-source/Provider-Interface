// A client's monthly budget (day-to-day income and spending plan): one
// budget per client per month (client_budgets) with lines grouped income /
// expenses / other (client_budget_lines). Separate from the PBA ledger.
// Income lines are seeded from the client's saved income sources — labels
// only, never amounts.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAccess } from "@/hooks/use-access";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import { BudgetEditor } from "./budget-editor";
import type { BudgetLine, MonthBudget } from "./budget-model";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyBudget({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id ?? "";
  const canEdit = useAccess().canCategory("billing", "edit");
  const qc = useQueryClient();
  const writeFn = useServerFn(writeClientRecord);
  const [month, setMonth] = useState(thisMonth());
  const periodMonth = `${month.slice(0, 7)}-01`;

  const sourcesQ = useQuery({
    enabled: !!clientId,
    queryKey: ["client-income-sources", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("income_sources")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      const raw = (data as { income_sources?: unknown } | null)?.income_sources;
      return Array.isArray(raw) ? (raw as string[]).filter((s) => s && s.trim()) : [];
    },
  });
  const budgetQ = useQuery({
    enabled: !!clientId && !!orgId,
    queryKey: ["client-month-budget", clientId, periodMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_budgets")
        .select("id, client_id, period_month, details")
        .eq("client_id", clientId)
        .eq("period_month", periodMonth)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MonthBudget | null;
    },
  });
  const budget = budgetQ.data ?? null;
  const linesQ = useQuery({
    enabled: !!budget?.id,
    queryKey: ["client-budget-lines", budget?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_budget_lines")
        .select("*")
        .eq("budget_id", budget!.id)
        .is("archived_at", null)
        .order("section")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as BudgetLine[];
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { ids } = await writeFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "client_budgets",
          op: "insert",
          values: { period_month: periodMonth, created_by: uid },
        },
      });
      const seed = (sourcesQ.data ?? []).map((label, i) => ({
        budget_id: ids[0],
        section: "income",
        sort_order: i,
        label: label.trim(),
        non_variable: 0,
        variable: 0,
      }));
      if (seed.length) {
        await writeFn({
          data: {
            organizationId: orgId,
            clientId,
            table: "client_budget_lines",
            op: "insert",
            values: seed,
          },
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-month-budget", clientId, periodMonth] });
      toast.success("Budget started for this month");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthName = new Date(`${periodMonth}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <SectionCard
      icon={Wallet}
      tone="profile"
      title="Monthly budget"
      description="Income and spending plan for the month. Separate from the PBA ledger."
      testId="client-monthly-budget"
      actions={
        <div className="flex items-center gap-2">
          <Label htmlFor="budget-month" className="text-xs text-muted-foreground">
            Month
          </Label>
          <Input
            id="budget-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || thisMonth())}
            className="h-10 w-[150px]"
          />
        </div>
      }
    >
      {budgetQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !budget ? (
        <div className="space-y-2">
          <EmptyState
            action={
              canEdit ? (
                <Button onClick={() => start.mutate()} disabled={start.isPending || !orgId}>
                  <Plus className="h-4 w-4" />
                  Start {monthName} budget
                </Button>
              ) : null
            }
          >
            No budget for {monthName}.
          </EmptyState>
          {canEdit && (sourcesQ.data?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Income lines start from the saved income sources: {sourcesQ.data!.join(", ")}
            </p>
          )}
        </div>
      ) : (
        <BudgetEditor
          budget={budget}
          lines={linesQ.data ?? []}
          canEdit={canEdit}
          clientId={clientId}
          organizationId={orgId}
          orgName={org?.organization_name ?? "Organization"}
          clientName={clientName}
        />
      )}
    </SectionCard>
  );
}
