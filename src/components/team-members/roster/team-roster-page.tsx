import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAccess } from "@/hooks/use-access";
import { listTeamRoster } from "@/lib/team-members/roster.functions";
import { listTeamInvites } from "@/lib/team-members/invites.functions";
import {
  baseRosterRows,
  filterRosterRows,
  parseRosterFilters,
  parseRosterSort,
  rosterFilterCounts,
  rosterPickOptions,
  rosterQueryKey,
  rosterViewCounts,
  serializeRosterFilters,
  serializeRosterSort,
  sortRosterRows,
  teamInvitesQueryKey,
  toggleRosterSort,
  type RosterSortKey,
} from "@/lib/team-members/roster";
import { OnboardingReturnBar } from "@/components/onboarding/onboarding-return-bar";
import { OnboardingGuidanceBanner } from "@/components/onboarding/onboarding-guidance-banner";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { RosterHeader } from "./roster-header";
import { RosterToolbar, type RosterSearchPatch, type RosterView } from "./roster-toolbar";
import { RosterTable } from "./roster-table";
import { RosterCards } from "./roster-cards";
import { InvitesView } from "./invites-view";
import { InactiveView } from "./inactive-view";
import { useRosterActions, useRowActionKeys } from "./use-roster-actions";

const rosterRoute = getRouteApi("/dashboard/team-members/");

/**
 * Team Members roster — the page body behind /dashboard/team-members.
 * One server call (listTeamRoster) loads every row; the Invited view comes
 * from listTeamInvites. Toolbar state (view, q, filter, home, preset,
 * supervisor, sort) lives in the route's search params.
 */
export function TeamRosterPage() {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id ?? null;
  const { canCategory } = useAccess();
  const seesHiring = canCategory("staff_hiring", "view");
  const search = rosterRoute.useSearch();
  const navigate = rosterRoute.useNavigate();

  const listRosterFn = useServerFn(listTeamRoster);
  const listInvitesFn = useServerFn(listTeamInvites);
  const roster = useQuery({
    enabled: !!orgId,
    queryKey: rosterQueryKey(orgId),
    queryFn: () => listRosterFn({ data: { organizationId: orgId! } }),
  });
  const invites = useQuery({
    enabled: !!orgId && seesHiring,
    queryKey: teamInvitesQueryKey(orgId),
    queryFn: () => listInvitesFn({ data: { organizationId: orgId! } }),
  });
  const actionKeys = useRowActionKeys();
  const { onAction, dialogs } = useRosterActions(orgId);

  const rows = useMemo(() => roster.data ?? [], [roster.data]);
  const activeRows = useMemo(() => rows.filter((r) => r.active), [rows]);
  const inviteRows = invites.data ?? [];
  // Invited and Inactive belong to Hire & deactivate (View).
  const view: RosterView =
    seesHiring && (search.view === "invited" || search.view === "inactive")
      ? search.view
      : "active";
  const filters = parseRosterFilters(search.filter);
  const sort = parseRosterSort(search.sort);
  const query = {
    view: view === "inactive" ? "inactive" : "active",
    q: search.q,
    home: search.home,
    preset: search.preset,
    supervisor: search.supervisor,
  } as const;
  const base = baseRosterRows(rows, query);
  const visible = sortRosterRows(filterRosterRows(rows, { ...query, filters }), sort);
  const counts = { ...rosterViewCounts(rows), invited: inviteRows.length };

  const onChange = useCallback(
    (patch: RosterSearchPatch) => {
      void navigate({
        replace: true,
        search: (prev) => {
          const next = { ...prev };
          if ("view" in patch) next.view = patch.view === "active" ? undefined : patch.view;
          if ("q" in patch) next.q = patch.q?.trim() ? patch.q : undefined;
          if ("filters" in patch) next.filter = serializeRosterFilters(patch.filters ?? []);
          if ("home" in patch) next.home = patch.home;
          if ("preset" in patch) next.preset = patch.preset;
          if ("supervisor" in patch) next.supervisor = patch.supervisor;
          return next;
        },
      });
    },
    [navigate],
  );
  const onSort = (key: RosterSortKey) =>
    void navigate({
      replace: true,
      search: (prev) => ({ ...prev, sort: serializeRosterSort(toggleRosterSort(sort, key)) }),
    });

  return (
    <AgencySetupCreateGate>
      <div className="space-y-6">
        <OnboardingReturnBar />
        <OnboardingGuidanceBanner step={2} />

        <RosterHeader
          organizationId={orgId}
          counts={counts}
          needsSetupRows={activeRows.filter((r) => r.needsSetup)}
          exportRows={view === "invited" ? null : visible}
          addFlag={search.add === "1"}
          importFlag={search.import === "1"}
        />

        <RosterToolbar
          view={view}
          counts={counts}
          showInvited={seesHiring}
          showInactive={seesHiring}
          q={search.q ?? ""}
          filters={filters}
          filterCounts={rosterFilterCounts(base)}
          home={search.home}
          preset={search.preset}
          supervisor={search.supervisor}
          homeOptions={rosterPickOptions(
            activeRows,
            (r) => r.homeId,
            (r) => r.homeName,
          )}
          presetOptions={rosterPickOptions(
            activeRows,
            (r) => r.presetId,
            (r) => r.presetName,
          )}
          supervisorOptions={rosterPickOptions(
            activeRows,
            (r) => r.supervisorId,
            (r) => r.supervisorName,
          )}
          onChange={onChange}
        />

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {view === "invited" ? (
            <InvitesView organizationId={orgId} rows={inviteRows} loading={invites.isLoading} />
          ) : roster.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team members…
            </div>
          ) : roster.isError ? (
            <p className="p-12 text-center text-sm text-destructive">
              Couldn't load team members: {(roster.error as Error).message}
            </p>
          ) : !visible.length ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              {view === "inactive"
                ? "No deactivated team members."
                : base.length
                  ? "No team members match these filters."
                  : "No active team members."}
            </p>
          ) : view === "inactive" ? (
            <InactiveView rows={visible} actionKeys={actionKeys} onAction={onAction} />
          ) : (
            <>
              <RosterCards rows={visible} actionKeys={actionKeys} onAction={onAction} />
              <RosterTable
                rows={visible}
                sort={sort}
                onSort={onSort}
                actionKeys={actionKeys}
                onAction={onAction}
              />
            </>
          )}
        </div>
        {dialogs}
      </div>
    </AgencySetupCreateGate>
  );
}
