// Editor for one month's budget: lines by section, totals, the narrative and
// the PDF bar. Edits are held locally until Save. Removing a line archives
// it (client_budget_lines.archived_at); nothing is deleted.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import { BudgetLinesTable, TotalTile } from "./budget-lines-table";
import {
  BUDGET_SECTIONS,
  sortLines,
  type BudgetLine,
  type BudgetSection,
  type MonthBudget,
} from "./budget-model";
import { BudgetPdfBar } from "./budget-pdf-bar";
import { useBudgetPdf } from "./use-budget-pdf";

export function BudgetEditor({
  budget,
  lines,
  canEdit,
  clientName,
  clientId,
  organizationId,
  orgName,
}: {
  budget: MonthBudget;
  lines: BudgetLine[];
  canEdit: boolean;
  clientName: string;
  clientId: string;
  organizationId: string;
  orgName: string;
}) {
  const qc = useQueryClient();
  const writeFn = useServerFn(writeClientRecord);
  const lineWrite = { organizationId, clientId, table: "client_budget_lines" } as const;
  const [draft, setDraft] = useState<BudgetLine[]>(lines);
  const [details, setDetails] = useState(budget.details ?? "");
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [detailsDirty, setDetailsDirty] = useState(false);

  useEffect(() => {
    setDraft(lines);
    setDirtyIds(new Set());
  }, [lines]);
  useEffect(() => {
    setDetails(budget.details ?? "");
    setDetailsDirty(false);
  }, [budget.id, budget.details]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["client-budget-lines", budget.id] });
    void qc.invalidateQueries({
      queryKey: ["client-month-budget", budget.client_id, budget.period_month],
    });
  };
  const onError = (e: Error) => toast.error(e.message);

  const addLine = useMutation({
    mutationFn: async (section: BudgetSection) => {
      const sort_order =
        Math.max(-1, ...draft.filter((l) => l.section === section).map((l) => l.sort_order)) + 1;
      await writeFn({
        data: {
          ...lineWrite,
          op: "insert",
          values: {
            budget_id: budget.id,
            section,
            sort_order,
            label: "",
            non_variable: 0,
            variable: 0,
          },
        },
      });
    },
    onSuccess: invalidate,
    onError,
  });
  const archiveLine = useMutation({
    mutationFn: async (id: string) => {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      await writeFn({
        data: {
          ...lineWrite,
          op: "update",
          id,
          values: { archived_at: new Date().toISOString(), archived_by: uid },
        },
      });
    },
    onSuccess: invalidate,
    onError,
  });
  const saveAll = useMutation({
    mutationFn: async () => {
      for (const l of draft.filter((x) => dirtyIds.has(x.id))) {
        const { label, non_variable, variable, notes, day_of_month } = l;
        await writeFn({
          data: {
            ...lineWrite,
            op: "update",
            id: l.id,
            values: { label, non_variable, variable, notes, day_of_month },
          },
        });
      }
      if (detailsDirty) {
        await writeFn({
          data: {
            organizationId,
            clientId,
            table: "client_budgets",
            op: "update",
            id: budget.id,
            values: { details },
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Budget saved");
      invalidate();
    },
    onError,
  });

  const patch = (id: string, changes: Partial<BudgetLine>) => {
    setDraft((prev) => prev.map((l) => (l.id === id ? { ...l, ...changes } : l)));
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const totals = useMemo(() => {
    const sum = (s: BudgetSection) =>
      draft
        .filter((l) => l.section === s)
        .reduce((a, l) => a + Number(l.non_variable) + Number(l.variable), 0);
    const income = sum("income"),
      expense = sum("expense"),
      other = sum("other");
    return { income, expense, other, difference: income - expense - other };
  }, [draft]);

  const periodLabel = new Date(`${budget.period_month}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const pdf = useBudgetPdf({
    organizationId,
    clientId,
    periodMonth: budget.period_month,
    periodLabel,
    clientName,
    payload: (logo) => {
      const toLines = (s: BudgetSection) =>
        sortLines(draft.filter((l) => l.section === s)).map((l) => ({
          label: l.label ?? "",
          non_variable: Number(l.non_variable) || 0,
          variable: Number(l.variable) || 0,
          notes: l.notes,
          day_of_month: l.day_of_month,
        }));
      return {
        orgName,
        logo,
        clientName,
        periodLabel,
        details,
        income: toLines("income"),
        expense: toLines("expense"),
        other: toLines("other"),
      };
    },
  });
  const dirty = dirtyIds.size > 0 || detailsDirty;

  return (
    <div className="space-y-6">
      <BudgetPdfBar
        pdf={pdf}
        periodLabel={periodLabel}
        clientName={clientName}
        canEdit={canEdit}
        dirty={dirty}
        saving={saveAll.isPending}
        onSave={() => saveAll.mutate()}
      />
      {BUDGET_SECTIONS.map(({ section, title }) => (
        <BudgetLinesTable
          key={section}
          title={title}
          section={section}
          lines={draft.filter((l) => l.section === section)}
          canEdit={canEdit}
          onAdd={() => addLine.mutate(section)}
          onArchive={(id) => archiveLine.mutate(id)}
          onPatch={patch}
        />
      ))}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <TotalTile label="Total income" value={totals.income} tone="positive" />
          <TotalTile label="Total expenses" value={totals.expense} tone="negative" />
          <TotalTile label="Total other" value={totals.other} tone="negative" />
          <TotalTile
            label="Difference"
            value={totals.difference}
            tone={totals.difference >= 0 ? "positive" : "danger"}
            emphasize
          />
        </div>
      </div>
      <div>
        <Label htmlFor="budget-details" className="text-sm font-medium">
          Details
        </Label>
        <p className="mb-1 text-xs text-muted-foreground">
          Banking notes, payback schedule, card use, spending guidance.
        </p>
        <Textarea
          id="budget-details"
          rows={5}
          value={details}
          disabled={!canEdit}
          onChange={(e) => {
            setDetails(e.target.value);
            setDetailsDirty(true);
          }}
        />
      </div>
    </div>
  );
}
