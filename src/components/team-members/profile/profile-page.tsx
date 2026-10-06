import { useEffect, useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ShieldAlert,
  StickyNote,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAccess } from "@/hooks/use-access";
import { isRouteUuid } from "@/lib/route-uuid";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileShell, type ProfileShellSection } from "@/components/profile-shell/profile-shell";
import { ProfileHeader } from "@/components/team-members/profile/profile-header";
import { StaffProfilePanel } from "@/components/team-members/profile/profile-tab";
import { StaffObligationsFilesTab } from "@/components/team-members/profile/file-tab";
import { NotesTab } from "@/components/team-members/profile/notes-tab";
import { ActivityTab } from "@/components/team-members/profile/activity-tab";
import { CaseloadTab } from "@/components/team-members/profile/caseload-tab";
import {
  AttentionStrip,
  OverviewSection,
} from "@/components/team-members/profile/overview-section";
import { TrainingSection } from "@/components/team-members/profile/training-section";
import { useMemberCaseload } from "@/components/team-members/profile/use-member-caseload";
import { ReviewEvidencePackDialog } from "@/components/team-members/add/review-evidence-dialog";
import { getTeamMemberProfile } from "@/lib/team-members/profile.functions";
import {
  getMemberOverview,
  memberOverviewQueryKey,
  memberTrainingQueryKey,
} from "@/lib/team-members/overview.functions";
import { teamMemberProfileQueryKey } from "@/lib/team-members/profile";
import { teamMemberCaseloadQueryKey } from "@/lib/team-members/caseload";
import { listStaffNotes } from "@/lib/team-members/notes.functions";
import { staffNotesQueryKey } from "@/lib/team-members/staff-notes";
import {
  PROFILE_TAB_LABEL,
  TEAM_MEMBER_PROFILE_TABS,
  profileTabSearchValue,
  resolveProfileTab,
  visibleProfileTabs,
  type TeamMemberProfileTab,
} from "@/lib/team-members/profile-tabs";
import { rosterQueryKey } from "@/lib/team-members/roster";
import { lastRosterSearch } from "@/lib/team-members/roster-return";

const profileRoute = getRouteApi("/dashboard/team-members/$staffId");

const SECTION_ICON: Record<TeamMemberProfileTab, LucideIcon> = {
  overview: LayoutDashboard,
  profile: User,
  file: FileText,
  training: GraduationCap,
  caseload: Users,
  notes: StickyNote,
  activity: Activity,
};

/** Overview data stays fresh: 60s stale, refetch on focus, invalidated after any action. */
const OVERVIEW_STALE_MS = 60_000;

/** Team member profile — the page body behind /dashboard/team-members/$staffId. */
export function ProfilePage() {
  const { staffId } = profileRoute.useParams();
  const { tab } = profileRoute.useSearch();
  const navigate = profileRoute.useNavigate();
  const { data: org } = useCurrentOrg();
  const { canCategory } = useAccess();
  const qc = useQueryClient();
  const loadFn = useServerFn(getTeamMemberProfile);
  const overviewFn = useServerFn(getMemberOverview);
  const notesFn = useServerFn(listStaffNotes);
  const [reviewing, setReviewing] = useState(false);
  const orgId = org?.organization_id;
  const validId = isRouteUuid(staffId);

  const profileQ = useQuery({
    enabled: !!orgId && validId,
    queryKey: teamMemberProfileQueryKey(orgId, staffId),
    queryFn: () => loadFn({ data: { organizationId: orgId!, staffId } }),
  });

  const overviewQ = useQuery({
    enabled: !!orgId && validId,
    queryKey: memberOverviewQueryKey(orgId, staffId),
    queryFn: () => overviewFn({ data: { organizationId: orgId!, staffUserId: staffId } }),
    staleTime: OVERVIEW_STALE_MS,
    refetchOnWindowFocus: true,
  });

  const caseloadQ = useMemberCaseload(orgId, staffId);

  const canSeeNotes = canCategory("staff_hiring", "view");
  // Same query key as the Notes tab: the badge reads the tab's own list.
  const notesQ = useQuery({
    enabled: !!orgId && validId && canSeeNotes,
    queryKey: staffNotesQueryKey(orgId ?? "", staffId),
    queryFn: () => notesFn({ data: { organizationId: orgId!, staffId } }),
  });

  // Any action taken on this page (evidence upload / accept / skip, caseload
  // save, profile save, note add, header actions) refreshes the Overview.
  useEffect(() => {
    if (!orgId) return;
    return qc.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        void qc.invalidateQueries({ queryKey: memberOverviewQueryKey(orgId, staffId) });
        void qc.invalidateQueries({ queryKey: memberTrainingQueryKey(orgId, staffId) });
      }
    });
  }, [qc, orgId, staffId]);

  const visible = visibleProfileTabs({ canSeeNotes });
  const activeTab = resolveProfileTab(tab, { canSeeNotes });

  if (!orgId || profileQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading team member profile…</div>;
  }
  if (profileQ.isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5" data-testid="profile-load-error">
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="text-destructive">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Couldn't load this team member: {safeErrorMessage(profileQ.error, "please try again.")}
          </p>
          <Button size="sm" variant="outline" onClick={() => void profileQ.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!profileQ.data) {
    return (
      <Card className="border-rose-200 bg-rose-50/30" data-testid="profile-not-found">
        <CardContent className="space-y-3 p-6 text-sm text-rose-700">
          <p>
            <ShieldAlert className="mr-2 inline h-4 w-4" />
            This person isn't a team member in this agency.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/dashboard/team-members" search={lastRosterSearch()}>
              Back to Team Members
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = profileQ.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: teamMemberProfileQueryKey(orgId, staffId) });
    void qc.invalidateQueries({ queryKey: teamMemberCaseloadQueryKey(orgId, staffId) });
    void qc.invalidateQueries({ queryKey: memberOverviewQueryKey(orgId, staffId) });
    void qc.invalidateQueries({ queryKey: rosterQueryKey(orgId) });
  };
  const select = (next: TeamMemberProfileTab) =>
    // Sections replace the entry: Back leaves the profile in one step.
    navigate({
      replace: true,
      search: (prev) => ({ ...prev, tab: profileTabSearchValue(next) }),
    });

  const overview = overviewQ.data ?? null;
  const fileBadge = overview?.fileBadgeCount ?? 0;
  const notesCount = notesQ.data?.length ?? 0;
  const sections: ProfileShellSection<TeamMemberProfileTab>[] = TEAM_MEMBER_PROFILE_TABS.map(
    (key) => ({
      key,
      label: PROFILE_TAB_LABEL[key],
      icon: SECTION_ICON[key],
      visible: visible.includes(key),
      badge:
        key === "file" && fileBadge > 0
          ? { count: fileBadge, tone: "warn" as const }
          : key === "notes" && canSeeNotes && notesCount > 0
            ? { count: notesCount, tone: "muted" as const }
            : null,
    }),
  );
  const attention = overview?.attention ?? [];

  return (
    <div
      className="min-w-0 max-w-full overflow-x-hidden"
      data-testid="staff-profile-page"
      data-staff-id={staffId}
      data-active-section={activeTab}
    >
      <ProfileShell
        header={
          <ProfileHeader
            orgId={orgId}
            data={data}
            onChanged={refresh}
            onReviewEvidence={() => setReviewing(true)}
          />
        }
        attention={<AttentionStrip items={attention} />}
        attentionCount={attention.length}
        attentionHomeKey="overview"
        sections={sections}
        activeKey={activeTab}
        onSelect={select}
        panel={null}
      >
        {activeTab === "overview" ? (
          <OverviewSection
            overview={overview}
            loading={overviewQ.isLoading}
            error={
              overviewQ.isError ? safeErrorMessage(overviewQ.error, "please try again.") : null
            }
            caseload={caseloadQ.data}
            caseloadLoading={caseloadQ.isLoading}
            onSelect={select}
          />
        ) : null}

        {activeTab === "profile" ? (
          <StaffProfilePanel
            key={staffId}
            orgId={orgId}
            data={data}
            onSaved={refresh}
            onReviewEvidence={() => setReviewing(true)}
          />
        ) : null}

        {activeTab === "file" ? (
          <div className="space-y-6">
            <StaffObligationsFilesTab
              organizationId={orgId}
              staffId={staffId}
              staffName={data.profile.displayName}
              items={data.evidence.items}
              files={data.evidence.files}
              names={data.names}
              onChanged={refresh}
              onReviewEvidence={() => setReviewing(true)}
            />
          </div>
        ) : null}

        {activeTab === "training" ? <TrainingSection orgId={orgId} staffId={staffId} /> : null}

        {activeTab === "caseload" ? (
          <CaseloadTab
            orgId={orgId}
            staffId={staffId}
            onSaved={refresh}
            onReviewEvidence={() => setReviewing(true)}
          />
        ) : null}

        {activeTab === "notes" && canSeeNotes ? (
          <NotesTab orgId={orgId} staffId={staffId} canAdd={canCategory("staff_hiring", "edit")} />
        ) : null}

        {activeTab === "activity" ? <ActivityTab orgId={orgId} staffId={staffId} /> : null}
      </ProfileShell>

      <ReviewEvidencePackDialog
        organizationId={reviewing ? orgId : null}
        userIds={reviewing ? [staffId] : []}
        onClose={() => {
          setReviewing(false);
          refresh();
        }}
      />
    </div>
  );
}
