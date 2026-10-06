// Bulk caseload editor for a single client. Multi-select staff with an
// explicit list of the client's authorized codes per staff. Checking a staff
// pre-checks every authorized code; what's saved is always that explicit
// list (never "all codes"). Saves via setStaffClientCodes — the same single
// write path the Authorized Codes section and Team Members use.
//
// Two modes:
//   • Live mode (clientId set, draftMode unset): fetches the current
//     assignments + authorized codes for the client and writes to DB.
//   • Draft mode (draftMode=true, controlled by value/onChange + explicit
//     authorizedCodes): used during the import-finalize step, BEFORE the
//     client row exists. Parent persists the chosen assignments after the
//     client is created.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Search, Save, X, Tag } from "lucide-react";
import { setStaffClientCodes } from "@/lib/scheduler/setup.functions";
import {
  assignmentCodes,
  normalizeServiceCodes,
  uncoveredCodes,
} from "@/lib/assignment-codes";
import { loadActiveCodes } from "@/lib/clients/codes";

type StaffOption = { id: string; name: string };

/** staff_id → the explicit codes that staff will be assigned. Never null. */
export type CaseloadDraftValue = Map<string, string[]>;

/** Staff checked with no codes picked — Save is blocked until fixed. */
export function staffMissingCodes(state: CaseloadDraftValue): string[] {
  return Array.from(state.entries())
    .filter(([, codes]) => codes.length === 0)
    .map(([id]) => id);
}

export type CaseloadEditorProps = {
  clientId?: string;
  draftMode?: boolean;
  /** Required when draftMode=true. */
  authorizedCodes?: string[];
  /** Controlled state in draft mode. */
  value?: CaseloadDraftValue;
  onChange?: (next: CaseloadDraftValue) => void;
};

export function CaseloadEditor(props: CaseloadEditorProps) {
  const { clientId, draftMode = false, authorizedCodes, value, onChange } = props;
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const qc = useQueryClient();
  const saveFn = useServerFn(setStaffClientCodes);

  // Staff pool (same in both modes).
  const staffQ = useQuery({
    enabled: !!orgId,
    queryKey: ["caseload-editor-staff", orgId],
    queryFn: async (): Promise<StaffOption[]> => {
      const { data: members, error: mErr } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId!)
        .eq("active", true);
      if (mErr) throw mErr;
      const ids = (members ?? [])
        .map((m) => (m as { user_id: string | null }).user_id)
        .filter((x): x is string => !!x);
      if (ids.length === 0) return [];
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name, is_active")
        .in("id", ids);
      if (pErr) throw pErr;
      return ((profs ?? []) as Array<{
        id: string; first_name: string | null; last_name: string | null;
        full_name: string | null; is_active: boolean | null;
      }>)
        .filter((p) => p.is_active !== false)
        .map((p) => ({
          id: p.id,
          name:
            (p.full_name?.trim()) ||
            [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
            "Staff",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  // Live mode only: existing assignments + client's authorized codes.
  const currentQ = useQuery({
    enabled: !draftMode && !!orgId && !!clientId,
    queryKey: ["caseload-editor-current-v2", orgId, clientId],
    queryFn: async (): Promise<{
      assignments: Array<{ staff_id: string; service_codes: string[] | null }>;
      codes: string[];
    }> => {
      const [a, c] = await Promise.all([
        supabase
          .from("staff_assignments")
          .select("staff_id, service_codes")
          .eq("organization_id", orgId!)
          .eq("client_id", clientId!),
        loadActiveCodes(supabase, [clientId!]),
      ]);
      if (a.error) throw a.error;
      const codes = c.get(clientId!) ?? [];
      return {
        assignments: ((a.data ?? []) as Array<{ staff_id: string; service_codes: string[] | null }>),
        codes,
      };
    },
  });

  // Local state for live mode; draft mode is controlled via value/onChange.
  const [liveState, setLiveState] = useState<CaseloadDraftValue>(new Map());
  const [search, setSearch] = useState("");

  // Seed live state once.
  useEffect(() => {
    if (draftMode) return;
    if (!currentQ.data) return;
    const next: CaseloadDraftValue = new Map();
    for (const r of currentQ.data.assignments) {
      next.set(r.staff_id, assignmentCodes(r.service_codes));
    }
    setLiveState(next);
  }, [draftMode, currentQ.data]);

  const codes = draftMode
    ? normalizeServiceCodes(authorizedCodes ?? [])
    : (currentQ.data?.codes ?? []);

  const state: CaseloadDraftValue = draftMode ? (value ?? new Map()) : liveState;
  const setState = (next: CaseloadDraftValue) => {
    if (draftMode) onChange?.(next);
    else setLiveState(next);
  };

  const original = useMemo<CaseloadDraftValue>(() => {
    if (draftMode) return new Map(); // draft starts empty; parent owns persistence
    const m: CaseloadDraftValue = new Map();
    for (const r of currentQ.data?.assignments ?? []) m.set(r.staff_id, assignmentCodes(r.service_codes));
    return m;
  }, [draftMode, currentQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = staffQ.data ?? [];
    if (!q) return all;
    return all.filter((s) => s.name.toLowerCase().includes(q));
  }, [staffQ.data, search]);

  function eqCodes(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    return b.every((x) => s.has(x));
  }

  const { toAdd, toRemove, toChange } = useMemo(() => {
    const add: string[] = [];
    const remove: string[] = [];
    const change: string[] = [];
    for (const [id, codes] of state.entries()) {
      if (!original.has(id)) add.push(id);
      else if (!eqCodes(original.get(id) ?? [], codes)) change.push(id);
    }
    for (const id of original.keys()) {
      if (!state.has(id)) remove.push(id);
    }
    return { toAdd: add, toRemove: remove, toChange: change };
  }, [state, original]);
  const dirty = toAdd.length + toRemove.length + toChange.length > 0;
  const missing = staffMissingCodes(state);
  const noStaffFor = uncoveredCodes(
    codes,
    Array.from(state.values()).map((service_codes) => ({ service_codes })),
  );

  const saveM = useMutation({
    mutationFn: async () => {
      if (missing.length > 0) {
        throw new Error("Pick at least one code for each checked staff, or uncheck them.");
      }
      const r = { added: 0, updated: 0, removed: 0 };
      const writes: Array<[string, string[], keyof typeof r]> = [
        ...toAdd.map((id): [string, string[], keyof typeof r] => [id, state.get(id) ?? [], "added"]),
        ...toChange.map((id): [string, string[], keyof typeof r] => [id, state.get(id) ?? [], "updated"]),
        ...toRemove.map((id): [string, string[], keyof typeof r] => [id, [], "removed"]),
      ];
      for (const [staffId, staffCodes, bucket] of writes) {
        await saveFn({
          data: { organizationId: orgId!, staffId, clientId: clientId!, codes: staffCodes },
        });
        r[bucket]++;
      }
      return r;
    },
    onSuccess: (r: { added: number; removed: number; updated: number }) => {
      toast.success(
        `Caseload saved — ${r.added} added, ${r.updated} updated, ${r.removed} removed.`,
      );
      qc.invalidateQueries({ queryKey: ["caseload-editor-current-v2"] });
      qc.invalidateQueries({ queryKey: ["client-code-assignments", clientId] });
      qc.invalidateQueries({ queryKey: ["caseload"] });
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
      qc.invalidateQueries({ queryKey: ["scheduler-data"] });
      qc.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleStaff(id: string) {
    const next = new Map(state);
    if (next.has(id)) next.delete(id);
    else next.set(id, [...codes]); // pre-check every authorized code; saved as an explicit list
    setState(next);
  }

  function setStaffCodes(id: string, codes: string[]) {
    const next = new Map(state);
    next.set(id, codes);
    setState(next);
  }

  function reset() {
    setState(new Map(original));
  }

  function scopeSummary(v: string[] | undefined): string {
    if (!v || v.length === 0) return "No codes";
    return v.join(", ");
  }

  const showSaveBar = !draftMode;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">
            {draftMode
              ? "Assign staff — who can work with this client"
              : "Caseload — staff who can work with this client"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Checking a staff pre-checks every authorized code. Open the code
            picker to narrow it (e.g. “Julie covers HHS only”). Staff can
            only be scheduled for, and clock into, the codes checked here.
            A new authorized code adds nobody automatically.
          </p>
        </div>
        {showSaveBar && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!dirty || saveM.isPending}
              className="min-h-11"
            >
              <X className="h-4 w-4 mr-1" /> Reset
            </Button>
            <Button
              size="sm"
              onClick={() => saveM.mutate()}
              disabled={!dirty || missing.length > 0 || saveM.isPending || !orgId || !clientId}
              className="min-h-11"
            >
              <Save className="h-4 w-4 mr-1" />
              {saveM.isPending
                ? "Saving…"
                : `Save (${toAdd.length}+/${toChange.length}~/${toRemove.length}−)`}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {codes.length === 0 && !(!draftMode && currentQ.isLoading) && (
          <p className="text-sm text-muted-foreground" data-testid="caseload-no-codes">
            This client has no authorized codes yet. Add a code before assigning staff.
          </p>
        )}
        {noStaffFor.length > 0 && (
          <ul className="space-y-0.5" data-testid="caseload-uncovered-codes">
            {noStaffFor.map((code) => (
              <li key={code} className="text-xs text-amber-700 dark:text-amber-400">
                No staff assigned to <span className="font-mono">{code}</span> yet
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 && (
          <p className="text-xs text-destructive">
            Pick at least one code for each checked staff, or uncheck them.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Badge variant="outline" className="ml-auto">
            {state.size} assigned
          </Badge>
        </div>

        {staffQ.isLoading || (!draftMode && currentQ.isLoading) ? (
          <p className="text-sm text-muted-foreground">Loading staff…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff match.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 max-h-[420px] overflow-y-auto rounded border p-2">
            {filtered.map((s) => {
              const checked = state.has(s.id);
              const wasOriginal = original.has(s.id);
              const scope = state.get(s.id) ?? [];
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted min-h-11 ${
                    checked ? "bg-muted/40" : ""
                  }`}
                >
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      disabled={!checked && codes.length === 0}
                      onCheckedChange={() => toggleStaff(s.id)}
                    />
                    <span className="flex-1 truncate">{s.name}</span>
                  </label>
                  {checked && (
                    <CodeScopePopover
                      authorized={codes}
                      value={scope}
                      onChange={(c) => setStaffCodes(s.id, c)}
                      summary={scopeSummary(scope)}
                    />
                  )}
                  {checked && !wasOriginal && (
                    <Badge variant="default" className="text-[10px]">new</Badge>
                  )}
                  {!checked && wasOriginal && (
                    <Badge variant="destructive" className="text-[10px]">remove</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CodeScopePopover({
  authorized,
  value,
  onChange,
  summary,
}: {
  authorized: string[];
  value: string[];
  onChange: (next: string[]) => void;
  summary: string;
}) {
  const picked = new Set(value);
  const allPicked = authorized.length > 0 && authorized.every((c) => picked.has(c));

  function toggle(code: string) {
    const next = new Set(picked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    // Keep the client's code order. Empty is allowed here; Save blocks it.
    onChange(authorized.filter((c) => next.has(c)));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1"
        >
          <Tag className="h-3 w-3" />
          <span className="max-w-[140px] truncate">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="text-xs font-medium px-1 pb-1">Service codes</div>
        {authorized.length === 0 ? (
          <div className="px-1 py-2 text-xs text-muted-foreground">
            No authorized codes on this client yet. Add a code before
            assigning staff.
          </div>
        ) : (
          <>
            <button
              type="button"
              className="w-full text-left text-xs rounded px-2 py-1.5 hover:bg-muted disabled:opacity-50"
              disabled={allPicked}
              onClick={() => onChange([...authorized])}
            >
              Select all ({authorized.length})
            </button>
            <div className="my-1 h-px bg-border" />
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {authorized.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox checked={picked.has(c)} onCheckedChange={() => toggle(c)} />
                  <span className="font-mono">{c}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
