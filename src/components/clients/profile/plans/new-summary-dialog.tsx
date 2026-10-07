// Create a draft progress summary row for one period; the summaries editor
// pre-fills and finalizes it.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeClientRecord } from "@/lib/clients/writes.functions";

export function NewSummaryDialog({
  clientId,
  orgId,
  serviceCodes,
  defaultKind = "quarterly",
  onClose,
  onCreated,
}: {
  clientId: string;
  orgId: string;
  serviceCodes: string[];
  /** Monthly when the client owes monthly summaries. */
  defaultKind?: "monthly" | "quarterly";
  onClose: () => void;
  onCreated: (summaryId: string) => void;
}) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const defaultQuarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const [periodKind, setPeriodKind] = useState<"monthly" | "quarterly">(defaultKind);
  const writeRecordFn = useServerFn(writeClientRecord);
  const [month, setMonth] = useState(defaultMonth);
  const [quarter, setQuarter] = useState(defaultQuarter);
  const [summaryKind, setSummaryKind] = useState<"narrative" | "financial_statement">("narrative");
  const [requiresUpi, setRequiresUpi] = useState(false);
  const [saving, setSaving] = useState(false);

  const computePeriod = () => {
    if (periodKind === "monthly") {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      const due = new Date(Date.UTC(y, m, 15));
      return {
        period_label: month,
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
      };
    }
    const match = /^(\d{4})-Q([1-4])$/.exec(quarter);
    if (!match) throw new Error("Invalid quarter (use YYYY-Q1..Q4)");
    const y = Number(match[1]);
    const qIdx = Number(match[2]) - 1;
    const startMonth = qIdx * 3;
    const start = new Date(Date.UTC(y, startMonth, 1));
    const end = new Date(Date.UTC(y, startMonth + 3, 0));
    // Quarter due 15 days after quarter end
    const due = new Date(end);
    due.setUTCDate(due.getUTCDate() + 15);
    return {
      period_label: `${y}-Q${qIdx + 1}`,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
    };
  };

  const submit = async () => {
    setSaving(true);
    try {
      const p = computePeriod();

      // Enforce the same summaryPeriodFloor as ensureCurrentSummaryPeriods.
      const [{ data: orgRow }, { data: clientRow }] = await Promise.all([
        supabase
          .from("organizations")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("go_live_date, created_at" as any)
          .eq("id", orgId)
          .maybeSingle(),
        supabase.from("clients").select("created_at").eq("id", clientId).maybeSingle(),
      ]);
      const org = orgRow as unknown as { go_live_date: string | null; created_at: string } | null;
      let hiveStart: string | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: hs } = await (supabase as any)
          .from("clients")
          .select("hive_start_date")
          .eq("id", clientId)
          .maybeSingle();
        hiveStart = (hs?.hive_start_date as string | null) ?? null;
      } catch {
        /* column may not exist yet */
      }
      const { summaryPeriodFloor } = await import("@/lib/progress-summaries");
      const floor = summaryPeriodFloor({
        orgGoLiveDate: org?.go_live_date ?? org?.created_at,
        clientHiveStartDate: hiveStart,
        clientCreatedAt: clientRow?.created_at,
      });
      if (floor && p.period_end < floor) {
        toast.error(
          `Cannot create a summary for a period that ended before this client's PI start (${floor}).`,
        );
        return;
      }

      const { ids } = await writeRecordFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "client_progress_summaries",
          op: "insert",
          values: {
            summary_kind: summaryKind,
            period_kind: periodKind,
            period_label: p.period_label,
            period_start: p.period_start,
            period_end: p.period_end,
            due_date: p.due_date,
            status: "pending",
            service_codes: serviceCodes,
            include_goal_progress: summaryKind === "narrative",
            requires_upi_attestation: requiresUpi,
          },
        },
      });
      toast.success("Summary started.");
      onCreated(ids[0]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create summary";
      if (/duplicate|unique/i.test(msg)) {
        toast.error("A summary for that period already exists.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-semibold">New progress summary</h3>
          <p className="text-xs text-muted-foreground">
            Starts the summary for one period; it opens next so Nectar can draft it from the notes.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs font-medium">Cadence</span>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={periodKind}
                onChange={(e) => setPeriodKind(e.target.value as "monthly" | "quarterly")}
              >
                <option value="quarterly">Quarterly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Kind</span>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={summaryKind}
                onChange={(e) =>
                  setSummaryKind(e.target.value as "narrative" | "financial_statement")
                }
              >
                <option value="narrative">Narrative (progress)</option>
                <option value="financial_statement">Financial statement</option>
              </select>
            </label>
          </div>
          {periodKind === "monthly" ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium">Month</span>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          ) : (
            <label className="block space-y-1">
              <span className="text-xs font-medium">Quarter (YYYY-Q#)</span>
              <Input
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="2026-Q1"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={requiresUpi}
              onChange={(e) => setRequiresUpi(e.target.checked)}
            />
            Requires UPI attestation (SEI/SJD)
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Starting…" : "Start summary"}
          </Button>
        </div>
      </div>
    </div>
  );
}
