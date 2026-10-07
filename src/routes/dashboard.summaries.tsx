import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2, AlertTriangle, Receipt, Eye, ArrowLeft, ChevronRight } from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";
import { contactsByClient, loadClientContacts, primaryContact } from "@/lib/clients/contacts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SummaryEditor } from "@/components/summaries/summary-editor";
import {
  ensureCurrentSummaryPeriods,
  listAllSummaries,
  type ProgressSummaryRow,
} from "@/lib/progress-summaries.functions";
import {
  formatPeriodMonthYear,
  isPeriodInProgress,
  summaryCadenceLabel,
  summaryFilingDestination,
} from "@/lib/progress-summaries";
import { isAdminLevel } from "@/lib/access/levels";

const searchSchema = z.object({
  open: z.string().uuid().optional(),
  client: z.string().uuid().optional(),
});

export const Route = createFileRoute("/dashboard/summaries")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Summaries — Provider Interface" }] }),
  component: SummariesPage,
});

function statusBadge(s: ProgressSummaryRow["status"]) {
  const map: Record<ProgressSummaryRow["status"], { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-slate-200 text-slate-800" },
    draft: { label: "Drafted by Nectar", cls: "bg-blue-100 text-blue-800" },
    in_review: { label: "In review", cls: "bg-amber-100 text-amber-800" },
    finalized: { label: "Finalized", cls: "bg-green-100 text-green-800" },
    no_source: { label: "No documentation", cls: "bg-red-100 text-red-800" },
  };
  const { label, cls } = map[s];
  return <Badge className={cls}>{label}</Badge>;
}

function dueTone(due: string, row: ProgressSummaryRow): "overdue" | "week" | "ok" | "done" {
  if (row.completed_at) return "done";
  if (row.status === "finalized" && row.requires_upi_attestation && !row.upi_entered_at) return "overdue";
  if (row.status === "finalized" && !row.requires_upi_attestation && !row.sc_sent_at) return "week";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 7) return "week";
  return "ok";
}

function SummariesPage() {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id ?? null;
  const role = org?.access.level;
  const isAdmin = isAdminLevel(role);
  const navigate = useNavigate({ from: "/dashboard/summaries" });
  const search = useSearch({ from: "/dashboard/summaries" });

  const ensureFn = useServerFn(ensureCurrentSummaryPeriods);
  const listFn = useServerFn(listAllSummaries);
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);
  const selectedClientId = search.client ?? null;

  const summariesQ = useQuery({
    enabled: !!orgId && isAdmin,
    queryKey: ["summaries", orgId],
    queryFn: async () => {
      // Generating this period's rows is best-effort — if it fails for any
      // reason, still show whatever summaries already exist instead of
      // silently rendering an empty list (which looked identical to "no
      // clients have active codes" and hid a real error).
      try {
        await ensureFn({ data: { organizationId: orgId! } });
      } catch (e) {
        console.error("[summaries] ensureCurrentSummaryPeriods failed:", e);
      }
      return listFn({ data: { organizationId: orgId! } });
    },
  });

  const clientsQ = useQuery({
    enabled: !!orgId,
    queryKey: ["summaries:clients", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, created_at")
        .eq("organization_id", orgId!)
        .order("last_name", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const contacts = await loadClientContacts(supabase, rows.map((c) => c.id));
      const byClient = contactsByClient(contacts);
      return rows.map((c) => ({
        ...c,
        support_coordinator_name:
          primaryContact(byClient.get(c.id) ?? [], "support_coordinator")?.name ?? null,
        hive_start_date: null as string | null,
      }));
    },
  });

  const nameOf = (id: string) => {
    const c = (clientsQ.data ?? []).find((x) => x.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown";
  };

  const byClient = useMemo(() => {
    const map = new Map<string, ProgressSummaryRow[]>();
    for (const s of summariesQ.data ?? []) {
      const arr = map.get(s.client_id) ?? [];
      arr.push(s);
      map.set(s.client_id, arr);
    }
    return map;
  }, [summariesQ.data]);

  const clientCards = useMemo(() => {
    const ids = new Set<string>([
      ...(clientsQ.data ?? []).map((c) => c.id),
      ...byClient.keys(),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return [...ids]
      .map((id) => {
        const rows = byClient.get(id) ?? [];
        const open = rows.filter((r) => !r.completed_at);
        // A row exists for the current, still-in-progress period too (so it
        // can be typed/drafted early) — that one isn't actually "owed" yet,
        // so it shouldn't count toward the open/overdue badge.
        const due = open.filter((r) => !isPeriodInProgress(r.period_end));
        const overdue = due.filter((r) => r.due_date < today && r.status !== "finalized");
        const next = [...open].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;
        const c = (clientsQ.data ?? []).find((x) => x.id === id);
        return {
          id,
          name: c ? `${c.first_name} ${c.last_name}` : nameOf(id),
          openCount: due.length,
          overdueCount: overdue.length,
          nextDue: next?.due_date ?? null,
          hasSei: rows.some((r) => r.service_codes?.includes("SEI") || r.service_codes?.includes("SJD")),
          hasQuarterly: rows.some((r) => r.period_kind === "quarterly"),
        };
      })
      .filter((c) => (byClient.get(c.id)?.length ?? 0) > 0)
      .sort((a, b) => {
        if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
        return a.name.localeCompare(b.name);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byClient, clientsQ.data]);

  useEffect(() => {
    if (search.open) setOpenId(search.open);
  }, [search.open]);

  if (!orgId) return null;
  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-xl border bg-card py-8 text-center text-muted-foreground">
          Summaries are managed by admins and managers only.
        </div>
      </div>
    );
  }

  const selectedClient = (clientsQ.data ?? []).find((c) => c.id === selectedClientId) ?? null;
  const selectedRows = selectedClientId ? (byClient.get(selectedClientId) ?? []) : [];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Open a person, draft goal progress with Nectar from code-tagged PI notes, finalize with
            attestation, download the packet, then mark sent to the Support Coordinator — or entered in UPI for SEI/SJD.
          </p>
        </div>
        <Button variant="outline" onClick={() => summariesQ.refetch()} disabled={summariesQ.isFetching}>
          {summariesQ.isFetching ? <Loader2 className="size-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {summariesQ.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            Could not load summaries: {summariesQ.error instanceof Error ? summariesQ.error.message : "Unknown error"}
          </span>
        </div>
      )}

      {!selectedClientId ? (
        <ClientList
          loading={summariesQ.isLoading || clientsQ.isLoading}
          cards={clientCards}
          onOpen={(id) => navigate({ search: { client: id } })}
        />
      ) : (
        <ClientWorkspace
          clientName={selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : nameOf(selectedClientId)}
          scName={selectedClient?.support_coordinator_name ?? null}
          rows={selectedRows}
          loading={summariesQ.isLoading}
          onBack={() => navigate({ search: {} })}
          onOpen={(id) => {
            setOpenId(id);
            navigate({ search: { client: selectedClientId, open: id } });
          }}
        />
      )}

      {openId && (
        <SummaryEditor
          summaryId={openId}
          organizationId={orgId}
          orgName={org?.organization_name ?? null}
          clientName={(() => {
            const row = (summariesQ.data ?? []).find((s) => s.id === openId);
            return row ? nameOf(row.client_id) : "";
          })()}
          onClose={() => {
            setOpenId(null);
            navigate({
              search: selectedClientId ? { client: selectedClientId } : {},
            });
            summariesQ.refetch();
          }}
        />
      )}
    </div>
  );
}

function ClientList({
  cards,
  onOpen,
  loading,
}: {
  cards: Array<{
    id: string;
    name: string;
    openCount: number;
    overdueCount: number;
    nextDue: string | null;
    hasSei: boolean;
    hasQuarterly: boolean;
  }>;
  onOpen: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin inline mr-2" /> Loading clients…
      </div>
    );
  }
  if (cards.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground rounded-xl border bg-card">
        No summary periods yet. Clients with active HHS/RHS/DSI/SLH/SLN/SEI (and related) codes appear here once their first period starts.
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onOpen(c.id)}
          className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="min-w-0">
            <div className="font-medium truncate">{c.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
              {c.hasSei && <span>SEI monthly (UPI)</span>}
              {c.hasQuarterly && <span>Quarterly → SC</span>}
              {c.nextDue && <span>Next due {c.nextDue}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {c.overdueCount > 0 ? (
              <Badge className="bg-red-100 text-red-800">{c.overdueCount} overdue</Badge>
            ) : c.openCount > 0 ? (
              <Badge className="bg-amber-100 text-amber-900">{c.openCount} open</Badge>
            ) : c.nextDue ? (
              <Badge className="bg-green-100 text-green-800">On track</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">No active codes</Badge>
            )}
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}

function ClientWorkspace({
  clientName,
  scName,
  rows,
  loading,
  onBack,
  onOpen,
}: {
  clientName: string;
  scName: string | null;
  rows: ProgressSummaryRow[];
  loading: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const monthly = rows
    .filter((r) => r.period_kind === "monthly")
    .sort((a, b) => b.period_end.localeCompare(a.period_end));
  const quarterly = rows
    .filter((r) => r.period_kind === "quarterly")
    .sort((a, b) => b.period_end.localeCompare(a.period_end));

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="size-4 mr-1" /> All clients
        </Button>
      </div>
      <div>
        <h2 className="text-xl font-semibold">{clientName}</h2>
        <p className="text-sm text-muted-foreground">
          Support Coordinator: {scName?.trim() || "Not on file"}
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="size-5 animate-spin inline" /></div>
      ) : (
        <div className="space-y-6">
          {monthly.length > 0 && (
            <PeriodSection
              title="Monthly"
              hint="SEI/SJD → UPI by the 15th · CMP/CMS/PN → Support Coordinator"
              rows={monthly}
              onOpen={onOpen}
            />
          )}
          {quarterly.length > 0 && (
            <PeriodSection
              title="Quarterly"
              hint="HHS / RHS / DSI / SLH / SLN · due 15 days after quarter end · send to Support Coordinator"
              rows={quarterly}
              onOpen={onOpen}
            />
          )}
          {monthly.length === 0 && quarterly.length === 0 && (
            <div className="rounded-xl border bg-card py-10 text-center text-muted-foreground">
              No periods for this client yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PeriodSection({
  title,
  hint,
  rows,
  onOpen,
}: {
  title: string;
  hint: string;
  rows: ProgressSummaryRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {rows.map((r) => {
          const tone = dueTone(r.due_date, r);
          const filing = summaryFilingDestination(r.summary_kind, r.service_codes);
          return (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium flex flex-wrap items-center gap-2">
                  {r.summary_kind === "financial_statement" ? (
                    <span className="inline-flex items-center gap-1">
                      <Receipt className="size-3.5" />
                      {r.period_label.replace(/-FS$/, "")} financial statement
                    </span>
                  ) : r.period_kind === "monthly" ? (
                    formatPeriodMonthYear(r.period_label.replace(/-FS$/, ""))
                  ) : (
                    r.period_label
                  )}
                  {statusBadge(r.status)}
                  {isPeriodInProgress(r.period_end) && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Not yet due — draft anytime
                    </Badge>
                  )}
                  {tone === "overdue" && <Badge className="bg-red-100 text-red-800">Overdue</Badge>}
                  {r.status === "finalized" && filing === "upi" && !r.upi_entered_at && (
                    <Badge className="bg-amber-100 text-amber-900">Awaiting UPI</Badge>
                  )}
                  {r.status === "finalized" && filing === "support_coordinator" && !r.sc_sent_at && (
                    <Badge className="bg-amber-100 text-amber-900">Awaiting SC send</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.service_codes.join(" · ") || "(no codes)"} · Due {r.due_date}
                  {" · "}
                  {summaryCadenceLabel(r.period_kind, r.service_codes).split(" · ").slice(1).join(" · ")}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpen(r.id)}>
                <Eye className="size-4 mr-1" /> Open
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
