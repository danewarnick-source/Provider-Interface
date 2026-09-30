/**
 * Sections on the Team Members profile page (`/dashboard/team-members/$staffId?tab=`).
 *
 * Overview | Profile | Team member file | Training | Caseload | Notes | Activity.
 * The URL param stays `tab` (and `file` stays the file's address) so old links
 * still work. Notes shows only to viewers with Hire & deactivate View; a ?tab=
 * the viewer can't open, or an unknown one, lands on Overview.
 */
export const TEAM_MEMBER_PROFILE_TABS = [
  "overview",
  "profile",
  "file",
  "training",
  "caseload",
  "notes",
  "activity",
] as const;
export type TeamMemberProfileTab = (typeof TEAM_MEMBER_PROFILE_TABS)[number];

export const DEFAULT_PROFILE_TAB: TeamMemberProfileTab = "overview";

export const PROFILE_TAB_LABEL: Record<TeamMemberProfileTab, string> = {
  overview: "Overview",
  profile: "Profile",
  file: "Team member file",
  training: "Training",
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
  return tab && visibleProfileTabs(viewer).includes(tab) ? tab : DEFAULT_PROFILE_TAB;
}

/** The ?tab= value to write for a tab: the default is left out of the URL. */
export function profileTabSearchValue(tab: TeamMemberProfileTab): TeamMemberProfileTab | undefined {
  return tab === DEFAULT_PROFILE_TAB ? undefined : tab;
}
