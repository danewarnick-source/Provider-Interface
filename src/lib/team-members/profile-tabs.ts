/**
 * Tabs on the Team Members profile page (`/dashboard/team-members/$staffId?tab=`).
 *
 * Every address in TEAM_MEMBER_PROFILE_TABS is accepted so links can be handed
 * out before a tab ships; only the RENDERED tabs draw today, and anything else
 * lands on Profile.
 */
export const TEAM_MEMBER_PROFILE_TABS = [
  "profile",
  "file",
  "caseload",
  "notes",
  "activity",
] as const;
export type TeamMemberProfileTab = (typeof TEAM_MEMBER_PROFILE_TABS)[number];

export const RENDERED_PROFILE_TABS = ["profile", "file", "activity"] as const;
export type RenderedProfileTab = (typeof RENDERED_PROFILE_TABS)[number];

export function isTeamMemberProfileTab(value: unknown): value is TeamMemberProfileTab {
  return (
    typeof value === "string" && (TEAM_MEMBER_PROFILE_TABS as readonly string[]).includes(value)
  );
}

/** Which tab the page draws for a validated (or missing) ?tab= value. */
export function resolveProfileTab(tab: TeamMemberProfileTab | undefined): RenderedProfileTab {
  return tab === "file" || tab === "activity" ? tab : "profile";
}
