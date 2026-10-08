// What a progress summary must contain under DHHS91172 (eff 7/1/26), by
// the codes it covers. One place for the contract's content rules: the
// deterministic review (progress-summary-review.ts) checks the items it can
// see in the text, and Nectar's review is given the full list with cites.
//
//   QUARTERLY (§1.25, every code that owes a summary unless replaced below):
//     (1) name (2) each service (3) date range (4) general summary of
//     services, status and response, notable events (5) progress toward
//     each goal, except ELS, MTP, PBA, PM1/PM2 and respite (6) staff name.
//   MONTHLY replaces quarterly (§1.25) for CMP/CMS, PN1/PN2, SEI, SJD:
//     CMP/CMS §32.3(2)(A–F) — same content as quarterly.
//     SEI §30.3(4)(A–G) — employment activities, response, progress toward
//       employment goals; typed into UPI.
//     SJD §33.3(4)(A–I) — SEI's items plus the weekly assessment data
//       (§33.2(j)) and the USOR contact date and funding status; UPI.
//     PN2 §19.2(10) — a status note on each Medical Care Plan item.
//     PN1 — §1.25 says the monthly summary replaces the quarterly one but
//       lists no PN1-specific items, so the quarterly content applies.
//   PBA → monthly financial statement (§1.25); not a narrative, not reviewed.
//
// Name, services, date range and the writer's name are printed by the
// summary document itself (header + "Finalized by"), so they are listed
// with source "document" and never flagged. Pure, node --test.

import {
  GOAL_PROGRESS_EXCLUDED_CODES,
  summaryCadenceForCode,
  type SummaryCadence,
} from "./progress-summaries.ts";

/** Where the item has to show up: the document header, the general notes, or each goal. */
export type RequirementSource = "document" | "general" | "goals";

export interface SummaryRequirement {
  id: string;
  /** Short plain label, e.g. "Person's response to services". */
  label: string;
  /** Contract cite, e.g. "DHHS91172 §1.25(4)". */
  cite: string;
  source: RequirementSource;
  /**
   * A text pattern that must appear somewhere in the typed summary for the
   * item to count as present. Only set where a word check is reliable
   * (USOR, weekly assessment, Medical Care Plan, employment activity);
   * the rest is left to Nectar's review.
   */
  detect?: RegExp;
}

const doc = (id: string, label: string, cite: string): SummaryRequirement => ({
  id,
  label,
  cite,
  source: "document",
});

function headerItems(sec: string, letters: [string, string, string, string]) {
  return [
    doc("name", "Person's name", `DHHS91172 ${sec}${letters[0]}`),
    doc("services", "Each service provided", `DHHS91172 ${sec}${letters[1]}`),
    doc("date_range", "Date range the summary covers", `DHHS91172 ${sec}${letters[2]}`),
    doc("staff_name", "Name of the staff writing the summary", `DHHS91172 ${sec}${letters[3]}`),
  ];
}

const QUARTERLY: SummaryRequirement[] = [
  ...headerItems("§1.25", ["(1)", "(2)", "(3)", "(6)"]),
  {
    id: "general_summary",
    label: "General summary of services provided",
    cite: "DHHS91172 §1.25(4)",
    source: "general",
  },
  {
    id: "status_response",
    label: "The person's status and response to services",
    cite: "DHHS91172 §1.25(4)",
    source: "general",
  },
  {
    id: "notable_events",
    label: "Notable events and activities related to the services",
    cite: "DHHS91172 §1.25(4)",
    source: "general",
  },
  {
    id: "goal_progress",
    label: "Progress toward each goal",
    cite: "DHHS91172 §1.25(5)",
    source: "goals",
  },
];

const CMP_CMS: SummaryRequirement[] = [
  ...headerItems("§32.3(2)", ["(A)", "(B)", "(C)", "(F)"]),
  {
    id: "general_summary",
    label: "General summary of the service provided",
    cite: "DHHS91172 §32.3(2)(D)",
    source: "general",
  },
  {
    id: "status_response",
    label: "The person's status and response to the service",
    cite: "DHHS91172 §32.3(2)(D)",
    source: "general",
  },
  {
    id: "notable_events",
    label: "Notable events and activities related to the service",
    cite: "DHHS91172 §32.3(2)(D)",
    source: "general",
  },
  {
    id: "goal_progress",
    label: "Progress toward the person's goals",
    cite: "DHHS91172 §32.3(2)(E)",
    source: "goals",
  },
];

const EMPLOYMENT_WORDS =
  /\b(job|jobs|work|worked|working|employ\w*|employer|shift|hours|interview\w*|applica\w*|resume|coworker\w*|supervisor|hired|task\w*)\b/i;

function employment(
  sec: string,
  letters: {
    name: string;
    svc: string;
    range: string;
    acts: string;
    resp: string;
    prog: string;
    staff: string;
  },
) {
  return [
    ...headerItems(sec, [letters.name, letters.svc, letters.range, letters.staff]),
    {
      id: "employment_activities",
      label: "Details of all employment activities",
      cite: `DHHS91172 ${sec}${letters.acts}`,
      source: "general" as const,
      detect: EMPLOYMENT_WORDS,
    },
    {
      id: "status_response",
      label: "The person's response to the services",
      cite: `DHHS91172 ${sec}${letters.resp}`,
      source: "general" as const,
    },
    {
      id: "goal_progress",
      label: "Progress toward the person's employment goals",
      cite: `DHHS91172 ${sec}${letters.prog}`,
      source: "goals" as const,
    },
  ];
}

const SEI = employment("§30.3(4)", {
  name: "(A)",
  svc: "(B)",
  range: "(C)",
  acts: "(D)",
  resp: "(E)",
  prog: "(F)",
  staff: "(G)",
});

const SJD: SummaryRequirement[] = [
  ...employment("§33.3(4)", {
    name: "(A)",
    svc: "(B)",
    range: "(C)",
    acts: "(D)",
    resp: "(E)",
    prog: "(F)",
    staff: "(H)",
  }),
  {
    id: "weekly_assessment",
    label: "Data from the weekly in-person assessment, with progress on each job strategy",
    cite: "DHHS91172 §33.3(4)(G), §33.2(j)",
    source: "general",
    detect: /\b(weekly|each week|every week|week of)\b|\bassess(ed|ment|ments)?\b/i,
  },
  {
    id: "usor_contact",
    label: "USOR contact date and the person's funding status with USOR",
    cite: "DHHS91172 §33.3(4)(I)",
    source: "general",
    detect: /\bUSOR\b|vocational rehab/i,
  },
];

const PN2: SummaryRequirement[] = [
  ...QUARTERLY,
  {
    id: "medical_care_plan",
    label: "A status note on each item in the Medical Care Plan",
    cite: "DHHS91172 §19.2(10)",
    source: "general",
    detect: /\b(medical )?care plan\b|\bMCP\b/i,
  },
];

/** The required contents for one code's summary; [] when the code owes none or only a financial statement. */
export function requirementsForCode(raw: string): SummaryRequirement[] {
  const code = raw.trim().toUpperCase();
  const cadence = summaryCadenceForCode(code);
  if (!cadence || cadence === "financial") return [];
  if (code === "SEI") return SEI;
  if (code === "SJD") return SJD;
  if (code === "CMP" || code === "CMS") return CMP_CMS;
  if (code === "PN2") return PN2;
  return QUARTERLY;
}

export interface SummaryRequirements {
  cadence: SummaryCadence | null;
  /** Each item once (by id; the first code's cite wins), document items first. */
  items: SummaryRequirement[];
  /** False when every code is in GOAL_PROGRESS_EXCLUDED_CODES (§1.25(5)). */
  goalProgress: boolean;
}

/** What a narrative summary covering `codes` must contain. Financial statements: nothing to review. */
export function summaryRequirements(
  codes: readonly string[],
  summaryKind = "narrative",
): SummaryRequirements {
  const upper = codes.map((c) => c.trim().toUpperCase()).filter(Boolean);
  const cadences = upper.map(summaryCadenceForCode).filter((c): c is SummaryCadence => !!c);
  const cadence = cadences.includes("monthly")
    ? "monthly"
    : cadences.includes("quarterly")
      ? "quarterly"
      : (cadences[0] ?? null);
  if (summaryKind !== "narrative") return { cadence, items: [], goalProgress: false };
  const goalProgress = upper.some((c) => !GOAL_PROGRESS_EXCLUDED_CODES.has(c));
  const byId = new Map<string, SummaryRequirement>();
  for (const code of upper) {
    for (const r of requirementsForCode(code)) if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const items = [...byId.values()]
    .filter((r) => goalProgress || r.id !== "goal_progress")
    .sort((a, b) => Number(a.source !== "document") - Number(b.source !== "document"));
  return { cadence, items, goalProgress };
}

/** "Progress toward each goal (DHHS91172 §1.25(5))" — one line per item for Nectar's prompt. */
export function requirementLines(items: readonly SummaryRequirement[]): string[] {
  return items
    .filter((r) => r.source !== "document")
    .map((r) => `[${r.id}] ${r.label} (${r.cite})`);
}
