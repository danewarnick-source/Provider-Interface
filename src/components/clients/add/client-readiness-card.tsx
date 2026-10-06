// Live readiness card — runs the real queries via clientReadiness and shows
// per-check ✓/✗ status. Every failing check is resolved INLINE on this card:
// no navigation, no links, no "go fix it elsewhere". Reuses the same inline
// forms the Finish-onboarding wizard uses so there's one implementation per
// concern.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ShieldCheck, AlertTriangle, X as XIcon } from "lucide-react";
import { CheckboxMultiSelect, type CheckboxMultiSelectOption } from "@/components/ui/checkbox-multi-select";
import { supabase } from "@/integrations/supabase/client";
import { clientReadiness, type ReadinessReport } from "@/lib/clients/readiness.functions";
import {
  getClientOnboardingState,
  addClientBillingCodes,
} from "@/lib/finish-onboarding.functions";
import {
  HomeForm,
  RatesForm,
  GuardianForm,
  type State as OnboardingState,
} from "@/components/clients/add/finish-onboarding-card";
import { CaseloadEditor } from "@/components/clients/shared/caseload-editor";
import { useCurrentPlanGoals } from "@/components/clients/shared/hooks/use-plan-goals";
import { FEATURE_CODES } from "@/lib/clients/features";
import { isClockableServiceCode, isDailyServiceCode } from "@/lib/service-billing";

type CheckKey =
  | "schedulable"
  | "hasStaff"
  | "evvReady"
  | "billable"
  | "guardianValid"
  | "goalsPresent";

const CHECKS: { key: CheckKey; label: string }[] = [
  { key: "schedulable",   label: "Has a clockable service code" },
  { key: "hasStaff",      label: "At least one staff assigned" },
  { key: "evvReady",      label: "Home geocoded for EVV" },
  { key: "billable",      label: "Rate & units set on at least one code" },
  { key: "guardianValid", label: "Guardian state valid" },
  { key: "goalsPresent",  label: "PCSP goals captured" },
];

export function useClientReadiness(clientId: string) {
  const fn = useServerFn(clientReadiness);
  return useQuery({
    queryKey: ["client-readiness", clientId],
    queryFn: () => fn({ data: { clientId } }) as Promise<ReadinessReport>,
  });
}

export function ClientReadinessCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const readinessQ = useClientReadiness(clientId);
  const stateFn = useServerFn(getClientOnboardingState);
  const stateQ = useQuery({
    queryKey: ["finish-onboarding", clientId],
    queryFn: () => stateFn({ data: { clientId } }) as Promise<OnboardingState>,
  });

  if (readinessQ.isLoading || stateQ.isLoading) return null;
  if (readinessQ.isError || !readinessQ.data) return null;
  if (stateQ.isError || !stateQ.data) return null;

  const r = readinessQ.data;
  const s = stateQ.data;
  const failingCount = CHECKS.filter((row) => !r[row.key]).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["client-readiness", clientId] });
    qc.invalidateQueries({ queryKey: ["finish-onboarding", clientId] });
    qc.invalidateQueries({ queryKey: ["client-profile"] });
    qc.invalidateQueries({ queryKey: ["client", clientId] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["scheduler-data"] });
    qc.invalidateQueries({ queryKey: ["caseload"] });
    qc.invalidateQueries({ queryKey: ["client-billing-codes"] });
    qc.invalidateQueries({ queryKey: ["client-codes-summary", clientId] });
  };

  return (
    <Card
      className={
        r.isLive
          ? "border-emerald-300/60 bg-emerald-50/30 dark:bg-emerald-950/10"
          : "border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          {r.isLive ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          )}
          <CardTitle className="text-base">
            {r.isLive ? "Client is live" : "Needs attention before going live"}
          </CardTitle>
        </div>
        <Badge variant="outline" className={r.isLive ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
          {CHECKS.length - failingCount}/{CHECKS.length} checks
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {CHECKS.map((row) => {
          const ok = r[row.key];
          return (
            <div key={row.key} className="rounded-md border border-border/60 bg-card">
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-600" />
                )}
                <span className={ok ? "" : "font-medium"}>{row.label}</span>
              </div>
              {!ok && (
                <div className="border-t border-border/60 p-3">
                  {row.key === "schedulable" && (
                    <CodesQuestion
                      clientId={clientId}
                      currentCodes={r.currentCodes}
                      clockableCodes={r.clockableCodes}
                      onSaved={refresh}
                    />
                  )}
                  {row.key === "hasStaff" && (
                    <CaseloadEditor clientId={clientId} />
                  )}
                  {row.key === "evvReady" && (
                    <HomeForm clientId={clientId} state={s} onSaved={refresh} />
                  )}
                  {row.key === "billable" && (
                    s.missingRates.length > 0 ? (
                      <RatesForm state={s} onSaved={refresh} />
                    ) : (
                      <CodesQuestion
                        clientId={clientId}
                        currentCodes={r.currentCodes}
                        clockableCodes={r.clockableCodes}
                        onSaved={refresh}
                      />
                    )
                  )}
                  {row.key === "guardianValid" && (
                    <GuardianForm clientId={clientId} state={s} onSaved={refresh} />
                  )}
                  {row.key === "goalsPresent" && (
                    <GoalsInlineForm clientId={clientId} onSaved={refresh} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ClientLiveBadge({ clientId }: { clientId: string }) {
  const q = useClientReadiness(clientId);
  if (q.isLoading || q.isError || !q.data) {
    return <Badge variant="outline">checking…</Badge>;
  }
  if (q.data.isLive) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        live
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
      needs attention
    </Badge>
  );
}

// ── Codes question (NECTAR states the situation, then asks) ───────────────
const ALL_CLOCKABLE_CODES: string[] = Array.from(
  new Set(Object.values(FEATURE_CODES).flat() as string[]),
)
  .filter((c) => isClockableServiceCode(c))
  .sort();

function CodesQuestion({
  clientId, currentCodes, clockableCodes, onSaved,
}: {
  clientId: string;
  currentCodes: string[];
  clockableCodes: string[];
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const addFn = useServerFn(addClientBillingCodes);

  const options: CheckboxMultiSelectOption[] = useMemo(() => {
    const have = new Set(currentCodes.map((c) => c.toUpperCase()));
    return ALL_CLOCKABLE_CODES.filter((c) => !have.has(c)).map((c) => ({
      value: c,
      label: c,
    }));
  }, [currentCodes]);

  const m = useMutation({
    mutationFn: () => addFn({ data: { clientId, codes: picked } }),
    onSuccess: (r) => {
      toast.success(`Added ${r.added} billing code${r.added === 1 ? "" : "s"}.`);
      setPicked([]);
      qc.invalidateQueries({ queryKey: ["client-codes-summary", clientId] });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nonClockable = currentCodes.filter((c) => !isClockableServiceCode(c));
  const situation = (() => {
    if (currentCodes.length === 0) {
      return "No service codes on file yet. Add the client's authorized DSPD codes below to enable scheduled clock-in shifts.";
    }
    if (clockableCodes.length === 0) {
      const tag = nonClockable.join(", ");
      const dailyNote = nonClockable
        .filter((c) => isDailyServiceCode(c))
        .map((c) => `${c} is a daily, non-clockable code`)
        .join("; ");
      return `This client has ${tag}${dailyNote ? ` — ${dailyNote}` : ""}. To schedule clock-in shifts, add any clockable service codes below.`;
    }
    return `Current codes: ${currentCodes.join(", ")}. Add additional clockable codes below if needed.`;
  })();

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{situation}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <CheckboxMultiSelect
            value={picked}
            onChange={setPicked}
            options={options}
            placeholder="Pick clockable DSPD service codes…"
            searchPlaceholder="Filter codes…"
            emptyLabel={options.length === 0 ? "No more clockable codes to add." : "No matches"}
            chipMonospace
          />
        </div>
        <Button
          size="sm"
          onClick={() => m.mutate()}
          disabled={m.isPending || picked.length === 0}
        >
          {m.isPending ? "Adding…" : `Add${picked.length ? ` ${picked.length}` : ""}`}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Codes are added at $0 — set rate &amp; annual units in the Rate &amp; units check below.
      </p>
    </div>
  );
}

// ── Goals inline form ─────────────────────────────────────────────────────
function GoalsInlineForm({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const [draft, setDraft] = useState("");
  const { goals, addGoal, endGoal } = useCurrentPlanGoals(clientId);
  const busy = addGoal.isPending || endGoal.isPending;

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (goals.some((g) => g.goal_text.trim().toLowerCase() === v.toLowerCase())) {
      toast.message("That goal is already in the list.");
      return;
    }
    addGoal.mutate(v, {
      onSuccess: () => {
        setDraft("");
        toast.success("Goal saved.");
        onSaved();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-2">
      {goals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {goals.map((g) => (
            <Badge key={g.id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[18rem] truncate">{g.goal_text}</span>
              <button
                type="button"
                aria-label="End goal"
                onClick={() => endGoal.mutate(g.id, { onSuccess: onSaved, onError: (e) => toast.error(e.message) })}
                disabled={busy}
                className="rounded hover:bg-muted-foreground/20 p-0.5"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a goal…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button size="sm" onClick={add} disabled={busy || !draft.trim()}>
          {addGoal.isPending ? "Saving…" : "Add goal"}
        </Button>
      </div>
    </div>
  );
}
