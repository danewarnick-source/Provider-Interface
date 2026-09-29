// Caseload tab on the team member profile. Clients + explicit service codes,
// per-client readiness from Evidence, and "Add client". Every save goes
// through setStaffClientCodes — the same function the client profile uses.
// Readiness warns only; it never blocks a save.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ChevronsUpDown, Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccess } from "@/hooks/use-access";
import { cn } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { recordStaffMandateOverride } from "@/lib/forms.functions";
import type { UnmetStaffMandate } from "@/lib/forms.functions";
import { setStaffClientCodes } from "@/lib/scheduler/setup.functions";
import type { CaseloadClient, MemberCaseloadData } from "@/lib/team-members/caseload.functions";
import { useMemberCaseload } from "@/components/team-members/profile/use-member-caseload";
import {
  addClientToDraft,
  addableClients,
  caseloadChanges,
  caseloadFactsFor,
  newEvidenceSuggestionKeys,
  removeClientFromDraft,
  selectAllDraftCodes,
  teamMemberCaseloadQueryKey,
  toggleDraftCode,
  type CaseloadChange,
  type CaseloadDraft,
} from "@/lib/team-members/caseload";
import {
  readinessBadge,
  staffClientReadiness,
  type Readiness,
  type ReadinessBadgeTone,
} from "@/lib/team-members/readiness";

const TONE: Record<ReadinessBadgeTone, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  warn: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
};

function savedDraft(data: MemberCaseloadData): CaseloadDraft {
  const out: Record<string, string[]> = {};
  for (const c of data.assigned) if (c.codes.length) out[c.clientId] = [...c.codes];
  return out;
}

function readinessFor(data: MemberCaseloadData, client: CaseloadClient): Readiness {
  const r = data.readinessInputs;
  return staffClientReadiness({
    today: r.today,
    hireDate: r.hireDate,
    evidence: r.evidence,
    client: { hasAbi: client.hasAbi, behaviorSupport: client.behaviorSupport },
    personTraining: { requiredIds: client.personTrainingIds, completedIds: r.completedTrainingIds },
    nameOf: (id) => data.names[id] ?? null,
  });
}

export function CaseloadTab({
  orgId,
  staffId,
  onReviewEvidence,
  onSaved,
}: {
  orgId: string;
  staffId: string;
  onReviewEvidence: () => void;
  onSaved: () => void;
}) {
  const q = useMemberCaseload(orgId, staffId);
  // Lives here so it survives the editor remounting after a save refetch.
  const [suggestions, setSuggestions] = useState<string[]>([]);

  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading caseload…</p>;
  }
  if (q.isError || !q.data) {
    return (
      <div
        className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm"
        data-testid="caseload-error"
      >
        <p className="text-destructive">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Couldn't load this caseload: {safeErrorMessage(q.error, "please try again.")}
        </p>
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <CaseloadEditor
      key={q.dataUpdatedAt}
      orgId={orgId}
      staffId={staffId}
      data={q.data}
      suggestions={suggestions}
      onSuggestions={setSuggestions}
      onReviewEvidence={onReviewEvidence}
      onSaved={onSaved}
    />
  );
}

function CaseloadEditor({
  orgId,
  staffId,
  data,
  suggestions,
  onSuggestions,
  onReviewEvidence,
  onSaved,
}: {
  orgId: string;
  staffId: string;
  data: MemberCaseloadData;
  suggestions: string[];
  onSuggestions: (keys: string[]) => void;
  onReviewEvidence: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { isOwner } = useAccess();
  const saveCodesFn = useServerFn(setStaffClientCodes);
  const recordOverride = useServerFn(recordStaffMandateOverride);
  const saved = useMemo(() => savedDraft(data), [data]);
  const [draft, setDraft] = useState<CaseloadDraft>(saved);
  const [pendingWarn, setPendingWarn] = useState<CaseloadChange[] | null>(null);
  const [pendingBlock, setPendingBlock] = useState<CaseloadChange[] | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const clientsById = useMemo(() => {
    const m = new Map<string, CaseloadClient>();
    for (const c of [...data.assigned, ...data.addable]) m.set(c.clientId, c);
    return m;
  }, [data]);

  const rows = useMemo(
    () =>
      Object.keys(draft)
        .map((id) => clientsById.get(id))
        .filter((c): c is CaseloadClient => !!c)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [draft, clientsById],
  );
  const options = useMemo(
    () =>
      addableClients(
        [...data.addable, ...data.assigned.filter((c) => !(c.clientId in draft))],
        draft,
      ),
    [data, draft],
  );
  const changes = useMemo(() => caseloadChanges(saved, draft), [saved, draft]);
  const flags = useMemo(() => [...clientsById.values()], [clientsById]);

  const saveM = useMutation({
    mutationFn: async (list: CaseloadChange[]) => {
      for (const ch of list) {
        await saveCodesFn({
          data: { organizationId: orgId, staffId, clientId: ch.clientId, codes: ch.codes },
        });
      }
      return list;
    },
    onSuccess: () => {
      const keys = newEvidenceSuggestionKeys({
        person: data.person,
        before: caseloadFactsFor(saved, flags),
        after: caseloadFactsFor(draft, flags),
        existingKeys: data.existingEvidenceKeys,
      });
      toast.success("Caseload saved");
      void qc.invalidateQueries({ queryKey: teamMemberCaseloadQueryKey(orgId, staffId) });
      void qc.invalidateQueries({ queryKey: ["my-assignments"] });
      void qc.invalidateQueries({ queryKey: ["caseload"] });
      void qc.invalidateQueries({ queryKey: ["nectar-pay-period"] });
      onSaved();
      onSuggestions(keys);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function recordBestEffort(
    list: CaseloadChange[],
    kind: "warn_proceed" | "block_override",
    reason?: string,
  ) {
    const added = list.filter((c) => c.kind === "added").map((c) => c.clientId);
    if (!added.length || !data.unmetMandates.length) return;
    void recordOverride({
      data: {
        staffId,
        clientIds: added,
        unmetFormIds: data.unmetMandates.map((u) => u.form_id),
        unmetFormNames: data.unmetMandates.map((u) => u.name),
        overrideKind: kind,
        overrideReason: reason,
      },
    }).catch((err: unknown) => console.warn("[caseload] recordStaffMandateOverride failed", err));
  }

  function attemptSave() {
    const list = changes;
    if (!list.length) return;
    // Required forms: the same warn / block gate the old Caseloads page had,
    // only when a client is being added.
    if (list.some((c) => c.kind === "added") && data.unmetMandates.length) {
      if (data.unmetMandates.some((u) => u.enforcement === "block")) {
        setOverrideReason("");
        setPendingBlock(list);
      } else {
        setPendingWarn(list);
      }
      return;
    }
    saveM.mutate(list);
  }

  const canEdit = data.canEdit;
  const busy = saveM.isPending;

  return (
    <section className="space-y-4" data-testid="caseload-tab">
      {data.unmetMandates.length ? <MandateNotice items={data.unmetMandates} /> : null}

      {suggestions.length && data.canReviewEvidence ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          data-testid="caseload-evidence-suggestions"
        >
          <span>New evidence suggestions</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onSuggestions([]);
              onReviewEvidence();
            }}
            data-testid="caseload-evidence-review"
          >
            Review
          </Button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Assigned clients</h2>
          {canEdit ? (
            <AddClientCombobox
              options={options}
              disabled={busy}
              onPick={(c) => setDraft((d) => addClientToDraft(d, c.clientId, c.authorizedCodes))}
            />
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="caseload-empty">
            No clients assigned yet.
          </p>
        ) : (
          <ul className="divide-y divide-border" data-testid="caseload-rows">
            {rows.map((c) => (
              <CaseloadRow
                key={c.clientId}
                client={c}
                codes={draft[c.clientId] ?? []}
                readiness={readinessFor(data, c)}
                canEdit={canEdit && !busy}
                onToggle={(code) =>
                  setDraft((d) => toggleDraftCode(d, c.clientId, code, c.authorizedCodes))
                }
                onSelectAll={() =>
                  setDraft((d) => selectAllDraftCodes(d, c.clientId, c.authorizedCodes))
                }
                onRemove={() => setDraft((d) => removeClientFromDraft(d, c.clientId))}
              />
            ))}
          </ul>
        )}
      </div>

      {canEdit && changes.length ? (
        <div
          className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
          data-testid="caseload-save-bar"
        >
          <span className="text-sm text-muted-foreground">
            {changes.length} unsaved change{changes.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setDraft(saved)}>
              Discard
            </Button>
            <Button size="sm" disabled={busy} onClick={attemptSave} data-testid="caseload-save">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save caseload
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={!!pendingWarn} onOpenChange={(o) => !o && setPendingWarn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Required forms not complete
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>This team member has incomplete required forms:</p>
                <ul className="list-disc pl-5">
                  {data.unmetMandates.map((u) => (
                    <li key={u.form_id}>{u.name}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground">You can proceed; this will be recorded.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const list = pendingWarn;
                setPendingWarn(null);
                if (list)
                  saveM.mutate(list, { onSuccess: () => recordBestEffort(list, "warn_proceed") });
              }}
            >
              Proceed anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingBlock}
        onOpenChange={(o) => {
          if (!o) {
            setPendingBlock(null);
            setOverrideReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Required forms block new clients
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>New clients can't be added until these required forms are complete:</p>
                <ul className="list-disc pl-5">
                  {data.unmetMandates.map((u) => (
                    <li key={u.form_id}>{u.name}</li>
                  ))}
                </ul>
                {isOwner ? (
                  <div className="pt-2">
                    <Label className="text-xs font-semibold">Override reason (required)</Label>
                    <Textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="mt-1 min-h-[72px]"
                      maxLength={1000}
                    />
                  </div>
                ) : (
                  <p className="rounded bg-amber-50 px-3 py-2 text-amber-900">
                    Only an Owner can override a blocking required form.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {isOwner ? (
              <AlertDialogAction
                disabled={!overrideReason.trim()}
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  const list = pendingBlock;
                  const reason = overrideReason.trim();
                  if (!list || !reason) return;
                  setPendingBlock(null);
                  setOverrideReason("");
                  saveM.mutate(list, {
                    onSuccess: () => recordBestEffort(list, "block_override", reason),
                  });
                }}
              >
                Override and save
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function MandateNotice({ items }: { items: UnmetStaffMandate[] }) {
  return (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      data-testid="caseload-unmet-mandates"
    >
      <p className="font-medium">
        <AlertTriangle className="mr-1.5 inline h-4 w-4" />
        Required forms not complete
      </p>
      <ul className="mt-1 list-disc pl-5">
        {items.map((u) => (
          <li key={u.form_id}>{u.name}</li>
        ))}
      </ul>
    </div>
  );
}

function CaseloadRow({
  client,
  codes,
  readiness,
  canEdit,
  onToggle,
  onSelectAll,
  onRemove,
}: {
  client: CaseloadClient;
  codes: readonly string[];
  readiness: Readiness;
  canEdit: boolean;
  onToggle: (code: string) => void;
  onSelectAll: () => void;
  onRemove: () => void;
}) {
  const badge = readinessBadge(readiness);
  const allOn =
    client.authorizedCodes.length > 0 && client.authorizedCodes.every((c) => codes.includes(c));
  return (
    <li className="space-y-2 py-3" data-testid="caseload-row" data-client-id={client.clientId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId: client.clientId }}
            className="truncate font-medium hover:underline"
          >
            {client.name}
          </Link>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
              TONE[badge.tone],
            )}
            data-testid="caseload-readiness"
          >
            {badge.label}
          </span>
        </div>
        {canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={`Remove ${client.name}`}
            data-testid="caseload-remove"
          >
            <X className="mr-1 h-4 w-4" /> Remove
          </Button>
        ) : null}
      </div>
      {client.authorizedCodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No authorized service codes for this client.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {client.authorizedCodes.map((code) => {
            const on = codes.includes(code);
            return (
              <button
                key={code}
                type="button"
                disabled={!canEdit}
                aria-pressed={on}
                onClick={() => onToggle(code)}
                className={cn(
                  "inline-flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 font-mono text-xs font-semibold transition",
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground",
                  canEdit ? "hover:border-primary/60" : "cursor-default",
                )}
                data-testid="caseload-code"
              >
                {on ? <Check className="h-3 w-3" /> : null}
                {code}
              </button>
            );
          })}
          {canEdit ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-1 text-xs"
              onClick={onSelectAll}
              data-testid="caseload-select-all"
            >
              {allOn ? "Clear all" : "Select all"}
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

function AddClientCombobox({
  options,
  disabled,
  onPick,
}: {
  options: CaseloadClient[];
  disabled: boolean;
  onPick: (c: CaseloadClient) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          data-testid="caseload-add-client"
        >
          Add client <ChevronsUpDown className="ml-1 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>No clients to add.</CommandEmpty>
            <CommandGroup>
              {options.map((c) => (
                <CommandItem
                  key={c.clientId}
                  value={`${c.name} ${c.clientId}`}
                  onSelect={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                >
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
