// Sections of the client profile (`/dashboard/clients/$clientId?section=`).
// Pure: no Supabase, importable by node --test. The side menu, the URL value
// and the old `?tab=` deep links all resolve through here.

export const CLIENT_PROFILE_SECTIONS = [
  "overview",
  "profile",
  "contacts",
  "health",
  "plans",
  "services",
  "money",
  "file",
  "team",
  "activity",
] as const;
export type ClientProfileSection = (typeof CLIENT_PROFILE_SECTIONS)[number];

export const DEFAULT_CLIENT_SECTION: ClientProfileSection = "overview";

export const CLIENT_SECTION_LABEL: Record<ClientProfileSection, string> = {
  overview: "Overview",
  profile: "Profile",
  contacts: "Contacts",
  health: "Health",
  plans: "Plans",
  services: "Services & billing",
  money: "Money",
  file: "Client file",
  team: "Team",
  activity: "Activity & notes",
};

/**
 * What the viewer may open. Health needs Client medical; Services needs
 * Billing; Money needs Billing and only shows for a client with PBA, loans or
 * spending (lib/clients/money.ts moneySectionApplies).
 */
export type ClientSectionViewer = { canMedical: boolean; canBilling: boolean; hasMoney?: boolean };

export function isClientProfileSection(v: unknown): v is ClientProfileSection {
  return typeof v === "string" && (CLIENT_PROFILE_SECTIONS as readonly string[]).includes(v);
}

/** The sections this viewer gets, in menu order. */
export function visibleClientSections(viewer: ClientSectionViewer): ClientProfileSection[] {
  return CLIENT_PROFILE_SECTIONS.filter((s) => {
    if (s === "health") return viewer.canMedical;
    if (s === "services") return viewer.canBilling;
    if (s === "money") return viewer.canBilling && viewer.hasMoney === true;
    return true;
  });
}

/** Old `?tab=` values (7-tab profile and older deep links) → the section that now holds them. */
const LEGACY_TAB_SECTION: Record<string, ClientProfileSection> = {
  overview: "overview",
  identity: "profile",
  profile: "profile",
  "care-plan": "plans",
  care: "plans",
  plan: "plans",
  compliance: "plans",
  summaries: "plans",
  deadlines: "overview",
  billing: "services",
  funds: "money",
  pba: "money",
  codes: "services",
  files: "file",
  "client-file": "file",
  documents: "file",
  pcsp: "file",
  hhcert: "file",
  operations: "team",
  caseload: "team",
  activity: "activity",
  shifts: "activity",
  logs: "activity",
  incidents: "activity",
};

/** The section an old `?tab=` value opens; null when it isn't one. */
export function sectionForLegacyTab(tab: string | null | undefined): ClientProfileSection | null {
  if (!tab) return null;
  return LEGACY_TAB_SECTION[tab] ?? (isClientProfileSection(tab) ? tab : null);
}

/** Which section the page draws: a section the viewer can't open, or none, lands on Overview. */
export function resolveClientSection(
  section: string | null | undefined,
  viewer: ClientSectionViewer,
): ClientProfileSection {
  return isClientProfileSection(section) && visibleClientSections(viewer).includes(section)
    ? section
    : DEFAULT_CLIENT_SECTION;
}

/** The `?section=` value to write: Overview is left out of the URL. */
export function clientSectionSearchValue(
  section: ClientProfileSection,
): ClientProfileSection | undefined {
  return section === DEFAULT_CLIENT_SECTION ? undefined : section;
}

/** Link to one section of a client's profile. */
export function clientSectionHref(clientId: string, section: ClientProfileSection): string {
  const value = clientSectionSearchValue(section);
  return `/dashboard/clients/${clientId}${value ? `?section=${value}` : ""}`;
}
