import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RequirePermission } from "@/components/rbac-guard";
import { ProfilePage } from "@/components/team-members/profile/profile-page";
import { redirectUnlessUuidParam } from "@/lib/route-uuid";
import { TEAM_MEMBER_PROFILE_TABS } from "@/lib/team-members/profile-tabs";

const profileSearch = z.object({
  tab: z.enum(TEAM_MEMBER_PROFILE_TABS).optional().catch(undefined),
});

export const Route = createFileRoute("/dashboard/team-members/$staffId")({
  beforeLoad: ({ params }) => {
    redirectUnlessUuidParam(params.staffId, {
      createTo: "/dashboard/team-members",
      createSearch: { add: 1 },
      fallbackTo: "/dashboard/team-members",
    });
  },
  validateSearch: (s: Record<string, unknown>) => profileSearch.parse(s),
  component: () => (
    <RequirePermission perm="view_staff_records">
      <ProfilePage />
    </RequirePermission>
  ),
});
