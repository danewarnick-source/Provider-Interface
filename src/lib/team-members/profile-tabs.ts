/**
 * Tabs on the Team Members profile page (`/dashboard/team-members/$staffId?tab=`).
 *
 * Profile | File | Caseload | Notes | Activity. Notes shows only to viewers with
 * Hire & deactivate View; a ?tab= the viewer can't open lands on Profile.
 */
export const TEAM_MEMBER_PROFILE_TABS = [
  "profile",
  "file",
  "caseload",
  "notes",
  "activity",
] as const;
export type TeamMemberProfileTab = (typeof TEAM_MEMBER_PROFILE_TABS)[number];

export const PROFILE_TAB_LABEL: Record<TeamMemberProfileTab, string> = {
  profile: "Profile",
  file: "File",
  caseload: "Caseload",
  notes: "Notes",
  activity: "Activity",
};

export function isTeamMemberProfileTab(value: unknown): value is TeamMemberProfileTab {
  return (
    typeof value === "string" && (TEAM_MEMBER_PROFILE_TABS as readonly string[]).includes(value)
  );
}

/** The tabs this viewer gets, in order. */
export function visibleProfileTabs(viewer: { canSeeNotes: boolean }): TeamMemberProfileTab[] {
  return TEAM_MEMBER_PROFILE_TABS.filter((t) => t !== "notes" || viewer.canSeeNotes);
}

/** Which tab the page draws for a validated (or missing) ?tab= value. */
export function resolveProfileTab(
  tab: TeamMemberProfileTab | undefined,
  viewer: { canSeeNotes: boolean } = { canSeeNotes: true },
): TeamMemberProfileTab {
  return tab && visibleProfileTabs(viewer).includes(tab) ? tab : "profile";
}
