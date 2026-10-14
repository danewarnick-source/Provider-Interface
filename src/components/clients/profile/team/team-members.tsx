// Team header and the team member cards: who works with this client, on
// which codes, and whether they're ready to work alone (same rules as Team
// Members). Each change saves that one team member through
// setStaffClientCodes, the single write path shared with Team Members.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { setStaffClientCodes } from "@/lib/scheduler/setup.functions";
import { uncoveredCodes } from "@/lib/assignment-codes";
import type { OverviewTeamMember } from "@/lib/clients/overview";
import { teamCards } from "@/lib/clients/team";
import { useOrgStaff } from "@/components/clients/shared/hooks/use-org-staff";
import { TeamCodesDialog, type TeamCodesTarget } from "./team-codes-dialog";
import { TeamMemberCard } from "./team-member-card";
import { useClientTeam } from "./use-client-team";
import { invalidateTeam } from "./team-changes";

export function TeamMembers({
  orgId,
  clientId,
  firstName,
  canEdit,
  readiness,
}: {
  orgId: string;
  clientId: string;
  firstName: string;
  canEdit: boolean;
  readiness: readonly OverviewTeamMember[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(setStaffClientCodes);
  const staffQ = useOrgStaff(orgId);
  const teamQ = useClientTeam(orgId, clientId);
  const [target, setTarget] = useState<TeamCodesTarget | null>(null);
  const assigned = teamQ.data?.assigned ?? new Map<string, string[]>();
  const codes = teamQ.data?.codes ?? [];
  const excluded = new Set((teamQ.data?.exclusions ?? []).map((e) => e.staff_user_id));
  const staff = staffQ.data ?? [];
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const cards = teamCards(assigned, names, readiness, codes);
  const nobodyFor = uncoveredCodes(
    codes,
    [...assigned.values()].map((service_codes) => ({ service_codes })),
  );
  const choices = staff
    .filter((s) => !assigned.has(s.id) && !excluded.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const saveM = useMutation({
    mutationFn: (v: { staffId: string; codes: string[] }) =>
      saveFn({ data: { organizationId: orgId, staffId: v.staffId, clientId, codes: v.codes } }),
    onSuccess: (_d, v) => {
      toast.success(v.codes.length ? "Team saved" : "Taken off the team");
      setTarget(null);
      invalidateTeam(qc);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidateTeam(qc);
    },
  });

  const assignButton = (
    <Button
      onClick={() => setTarget({ staffId: null, name: null, codes: [] })}
      disabled={codes.length === 0}
    >
      <Plus className="h-4 w-4" /> Assign team member
    </Button>
  );

  return (
    <>
      <SectionCard
        icon={Users}
        tone="ok"
        title="Team"
        description={`Team members who work with ${firstName}, and on which codes.`}
        testId="client-team-codes"
        actions={canEdit ? assignButton : null}
      >
        {teamQ.isLoading || staffQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team…</p>
        ) : codes.length === 0 ? (
          <EmptyState>
            No active codes yet. Add an authorization in Services & billing before assigning team
            members.
          </EmptyState>
        ) : cards.length === 0 ? (
          <EmptyState action={canEdit ? assignButton : null}>
            Nobody works with {firstName} yet. Assign the team members who'll be scheduled.
          </EmptyState>
        ) : nobodyFor.length ? (
          <p className="text-sm font-medium text-[var(--hive-danger-fg)]">
            Nobody is assigned{" "}
            <span className="font-mono">{nobodyFor.join(", ")}</span> yet. A new code adds nobody
            automatically.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {cards.length} on the team. A new code adds nobody automatically.
          </p>
        )}
      </SectionCard>

      {cards.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <TeamMemberCard
              key={c.id}
              card={c}
              canEdit={canEdit}
              busy={saveM.isPending}
              onEdit={() => setTarget({ staffId: c.id, name: c.name, codes: c.codes })}
              onRemove={() =>
                window.confirm(`Take ${c.name} off ${firstName}'s team?`) &&
                saveM.mutate({ staffId: c.id, codes: [] })
              }
            />
          ))}
        </ul>
      ) : null}

      {target ? (
        <TeamCodesDialog
          target={target}
          clientCodes={codes}
          choices={choices}
          saving={saveM.isPending}
          onClose={() => setTarget(null)}
          onSave={(staffId, picked) => saveM.mutate({ staffId, codes: picked })}
        />
      ) : null}
    </>
  );
}
