// Registry of stable tour anchors. Add a new entry here and the corresponding
// data-tour="..." attribute on the element. NECTAR's guided tours can only
// reference anchors that exist here — never invent IDs.

export type TourSurface = "admin" | "staff" | "both";

export type TourAnchor = {
  id: string;
  label: string;
  route: string;
  description: string;
  surface: TourSurface;
};

export const TOUR_ANCHORS: TourAnchor[] = [
  // Sidebar navigation (admin)
  {
    id: "nav.evidence",
    label: "Evidence",
    route: "/dashboard/evidence",
    description: "People × requirements tracker. Packs are suggestions, not a scoreboard.",
    surface: "admin",
  },
  {
    id: "nav.help",
    label: "Ask NECTAR",
    route: "/dashboard/help",
    description: "Chat with NECTAR for help anywhere in PI.",
    surface: "admin",
  },
  {
    id: "nav.settings",
    label: "Settings",
    route: "/dashboard/settings",
    description: "Organization settings.",
    surface: "admin",
  },

  // Page-level CTAs (admin)
  {
    id: "audit.body",
    label: "Audit zone body",
    route: "/dashboard/audit",
    description: "Where audit folders, items needed and items provided are shown.",
    surface: "admin",
  },
  {
    id: "authsources.upload",
    label: "Add a document to the Knowledge base",
    route: "/dashboard/hub/knowledge",
    description:
      "New document: type a policy or upload a PDF, Word or text file. It saves as a draft; Nectar uses it once published.",
    surface: "admin",
  },

  // Staff navigation — ids match data-tour={`nav.${slug}`} on the staff sidebar
  {
    id: "nav.home",
    label: "My Caseload",
    route: "/dashboard",
    description:
      "Your assigned people. Host-home (HHS) names open the daily note. Time-clock codes open Punch pad.",
    surface: "staff",
  },
  {
    id: "nav.schedule",
    label: "Schedule",
    route: "/dashboard/schedule",
    description: "Today and upcoming scheduled shifts.",
    surface: "staff",
  },
  {
    id: "nav.daily-logs",
    label: "Daily Logs",
    route: "/dashboard/daily-logs",
    description: "Host-home and RP5 daily progress notes.",
    surface: "staff",
  },
  {
    id: "nav.my-obligations",
    label: "Staff file",
    route: "/dashboard/my-obligations",
    description: "Trainings, policies, and other items you still owe.",
    surface: "staff",
  },
  {
    id: "nav.my-historical-records",
    label: "Historical Records",
    route: "/dashboard/my-historical-records",
    description: "Past notes and timesheets brought over for you to review.",
    surface: "staff",
  },
  {
    id: "nav.my-time-corrections",
    label: "My Time Corrections",
    route: "/dashboard/my-time-corrections",
    description: "Correction requests you sent to a supervisor.",
    surface: "staff",
  },
  {
    id: "nav.ask-nectar",
    label: "Ask NECTAR",
    route: "/dashboard/ask-nectar",
    description: "Ask NECTAR a staff question about your shift, caseload, or a form.",
    surface: "staff",
  },
  {
    id: "nav.hive-training",
    label: "Training",
    route: "/dashboard/hive-training",
    description: "Admin class roster and locked seat prices.",
    surface: "admin",
  },

  // Staff page CTAs
  {
    id: "staff.caseload",
    label: "Caseload list",
    route: "/dashboard",
    description: "The list of people assigned to you. Tap an HHS name for the daily note.",
    surface: "staff",
  },
  {
    id: "staff.daily-note",
    label: "Daily progress note",
    route: "/dashboard/daily-logs",
    description: "Write the host-home daily note: goals, medications, and narrative.",
    surface: "staff",
  },
];

export function findAnchor(id: string): TourAnchor | undefined {
  return TOUR_ANCHORS.find((a) => a.id === id);
}

export function anchorsForSurface(surface: string): TourAnchor[] {
  const s = surface === "staff" ? "staff" : "admin";
  return TOUR_ANCHORS.filter((a) => a.surface === s || a.surface === "both");
}

export function anchorsForPrompt(surface = "admin"): string {
  return anchorsForSurface(surface)
    .map((a) => `- ${a.id} (${a.route}) — ${a.description}`)
    .join("\n");
}
