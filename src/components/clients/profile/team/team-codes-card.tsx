// Who works with this client, on which codes. Checking a team member
// pre-checks every active code; what's saved is always that explicit list
// (never "all codes"). Saves through setStaffClientCodes — the single write
// path shared with Team Members. Shows "ready to work alone" from the same
// rules as Team Members, and refuses anyone on the do-not-schedule list.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, Search, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { setStaffClientCodes } from "@/lib/scheduler/setup.functions";
import { uncoveredCodes } from "@/lib/assignment-codes";
import type { OverviewTeamMember } from "@/lib/clients/overview";
import { useOrgStaff } from "@/components/clients/shared/hooks/use-org-staff";
import { CodeScopePopover } from "./code-scope-popover";
import { useClientTeam } from "./use-client-team";
import { assignmentChanges, staffMissingCodes } from "@/lib/clients/team";
import { invalidateTeam } from "./team-changes";

export function TeamCodesCard({
  orgId,
  clientId,
  canEdit,
  readiness,
}: {
  orgId: string;
  clientId: string;
  canEdit: boolean;
  readiness: readonly OverviewTeamMember[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(setStaffClientCodes);
  const staffQ = useOrgStaff(orgId);
  const teamQ = useClientTeam(orgId, clientId);
  const [state, setState] = useState<Map<string, string[]>>(new Map());
  const [search, setSearch] = useState("");

  const original = useMemo(() => teamQ.data?.assigned ?? new Map<string, string[]>(), [teamQ.data]);
  useEffect(() => setState(new Map(original)), [original]);
  const codes = teamQ.data?.codes ?? [];
  const excluded = new Set((teamQ.data?.exclusions ?? []).map((e) => e.staff_user_id));
  const ready = new Map(readiness.map((r) => [r.id, r]));
  const changes = assignmentChanges(original, state);
  const missing = staffMissingCodes(state);
  const noStaffFor = uncoveredCodes(
    codes,
    [...state.values()].map((service_codes) => ({ service_codes })),
  );
  const staff = (staffQ.data ?? [])
    .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(state.has(b.id)) - Number(state.has(a.id)));

  const saveM = useMutation({
    mutationFn: async () => {
      for (const [staffId, staffCodes] of changes.writes) {
        await saveFn({ data: { organizationId: orgId, staffId, clientId, codes: staffCodes } });
      }
    },
    onSuccess: () => {
      toast.success("Team saved");
      invalidateTeam(qc);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidateTeam(qc);
    },
  });

  const toggle = (id: string) => {
    const next = new Map(state);
    if (next.has(id)) next.delete(id);
    else next.set(id, [...codes]);
    setState(next);
  };

  return (
    <SectionCard
      icon={Users}
      tone="ok"
      title="Team and codes"
      description="Team members can only be scheduled for, and clock into, the codes checked here."
      testId="client-team-codes"
      actions={
        canEdit ? (
          <>
            <Button
              variant="outline"
              onClick={() => setState(new Map(original))}
              disabled={!changes.dirty || saveM.isPending}
            >
              <X className="h-4 w-4" /> Undo changes
            </Button>
            <Button
              onClick={() => saveM.mutate()}
              disabled={!changes.dirty || missing.length > 0 || saveM.isPending}
            >
              <Save className="h-4 w-4" /> {saveM.isPending ? "Saving…" : "Save team"}
            </Button>
          </>
        ) : null
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">A new code adds nobody automatically.</p>
        {!teamQ.isLoading && codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This client has no active codes yet. Add one in Services & billing before assigning team
            members.
          </p>
        ) : null}
        {noStaffFor.map((code) => (
          <p key={code} className="text-xs font-medium text-[var(--hive-danger-fg)]">
            Nobody is assigned <span className="font-mono">{code}</span> yet
          </p>
        ))}
        {missing.length > 0 ? (
          <p className="text-xs text-destructive">
            Pick at least one code for each checked team member, or uncheck them.
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter team members…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Badge variant="outline" className="ml-auto">
            {state.size} on the team
          </Badge>
        </div>
        {staffQ.isLoading || teamQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team…</p>
        ) : (
          <ul className="max-h-[480px] divide-y overflow-y-auto rounded-xl border">
            {staff.map((s) => {
              const checked = state.has(s.id);
              const isExcluded = excluded.has(s.id);
              const r = ready.get(s.id);
              return (
                <li
                  key={s.id}
                  className="flex min-h-11 flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={checked}
                      disabled={!canEdit || (!checked && (isExcluded || codes.length === 0))}
                      onCheckedChange={() => toggle(s.id)}
                      aria-label={`On ${s.name}'s team`}
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                  {isExcluded ? <Badge variant="destructive">Do not schedule</Badge> : null}
                  {checked && r ? (
                    <Badge variant={r.readyAlone ? "secondary" : "outline"}>
                      {r.readinessLabel}
                    </Badge>
                  ) : null}
                  {checked ? (
                    <CodeScopePopover
                      authorized={codes}
                      value={state.get(s.id) ?? []}
                      onChange={(c) => setState(new Map(state).set(s.id, c))}
                      disabled={!canEdit}
                    />
                  ) : null}
                  {checked && !original.has(s.id) ? <Badge>new</Badge> : null}
                  {!checked && original.has(s.id) ? (
                    <Badge variant="destructive">remove</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
