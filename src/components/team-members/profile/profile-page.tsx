import { useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAccess } from "@/hooks/use-access";
import { isRouteUuid } from "@/lib/route-uuid";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileHeader } from "@/components/team-members/profile/profile-header";
import { StaffProfilePanel } from "@/components/team-members/profile/profile-tab";
import { StaffObligationsFilesTab } from "@/components/team-members/profile/file-tab";
import { NotesTab } from "@/components/team-members/profile/notes-tab";
import { ActivityTab } from "@/components/team-members/profile/activity-tab";
import { ReviewEvidencePackDialog } from "@/components/team-members/add/review-evidence-dialog";
import { getTeamMemberProfile } from "@/lib/team-members/profile.functions";
import { teamMemberProfileQueryKey } from "@/lib/team-members/profile";
import {
  PROFILE_TAB_LABEL,
  resolveProfileTab,
  visibleProfileTabs,
  type TeamMemberProfileTab,
} from "@/lib/team-members/profile-tabs";
import { rosterQueryKey } from "@/lib/team-members/roster";
import { lastRosterSearch } from "@/lib/team-members/roster-return";

const profileRoute = getRouteApi("/dashboard/team-members/$staffId");

/** Team member profile — the page body behind /dashboard/team-members/$staffId. */
export function ProfilePage() {
  const { staffId } = profileRoute.useParams();
  const { tab } = profileRoute.useSearch();
  const navigate = profileRoute.useNavigate();
  const { data: org } = useCurrentOrg();
  const { canCategory } = useAccess();
  const qc = useQueryClient();
  const loadFn = useServerFn(getTeamMemberProfile);
  const [reviewing, setReviewing] = useState(false);
  const orgId = org?.organization_id;

  const profileQ = useQuery({
    enabled: !!orgId && isRouteUuid(staffId),
    queryKey: teamMemberProfileQueryKey(orgId, staffId),
    queryFn: () => loadFn({ data: { organizationId: orgId!, staffId } }),
  });

  const canSeeNotes = canCategory("staff_hiring", "view");
  const tabs = visibleProfileTabs({ canSeeNotes });
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
    void qc.invalidateQueries({ queryKey: rosterQueryKey(orgId) });
  };

  return (
    <div
      className="min-w-0 max-w-full space-y-6 overflow-x-hidden"
      data-testid="staff-profile-page"
      data-staff-id={staffId}
    >
      <ProfileHeader
        orgId={orgId}
        data={data}
        onChanged={refresh}
        onReviewEvidence={() => setReviewing(true)}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          // Tabs replace the entry: Back leaves the profile in one step.
          navigate({
            replace: true,
            search: (prev) => ({
              ...prev,
              tab: v === "profile" ? undefined : (v as TeamMemberProfileTab),
            }),
          })
        }
        className="w-full"
      >
        <TabsList className="flex h-auto w-full min-w-0 max-w-full flex-wrap justify-start overflow-x-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t}>
              {PROFILE_TAB_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <StaffProfilePanel
            key={staffId}
            orgId={orgId}
            data={data}
            onSaved={refresh}
            onReviewEvidence={() => setReviewing(true)}
          />
        </TabsContent>

        <TabsContent value="file" className="mt-4 space-y-6">
          <StaffObligationsFilesTab
            organizationId={orgId}
            staffId={staffId}
            staffName={data.profile.displayName}
          />
        </TabsContent>

        <TabsContent value="caseload" className="mt-4">
          <section
            className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground"
            data-testid="caseload-tab"
          >
            Clients and service codes for this team member are managed on{" "}
            <Link to="/dashboard/assignments" className="text-primary hover:underline">
              Assignments
            </Link>
            .
          </section>
        </TabsContent>

        {canSeeNotes ? (
          <TabsContent value="notes" className="mt-4">
            <NotesTab
              orgId={orgId}
              staffId={staffId}
              canAdd={canCategory("staff_hiring", "edit")}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="activity" className="mt-4">
          <ActivityTab orgId={orgId} staffId={staffId} />
        </TabsContent>
      </Tabs>

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
