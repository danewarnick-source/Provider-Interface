/**
 * Agency setup gate — server-authoritative completion from saved facts.
 * Staff and client creation stay closed until every required operating
 * question has a recorded answer. Banner math is display-only.
 */

import {
  AWARDED_SERVICE_CODES_FACT_KEY,
  awardedCodesUnanswered,
} from "./obligations/setup-facts.ts";
import {
  EMPTY_ORG_FACTS,
  ORG_FACT_DEFINITIONS,
  computeObligationApplicability,
  parseFactAnswer,
  type FactAnswer,
  type ObligationApplicability,
  type OrgFacts,
} from "./obligations/applicability.ts";
import {
  CORE_RULE_LOGIC_SLICE,
  canActivate,
  simulateDraftRules,
  type SimulationResult,
  type SyntheticStaff,
} from "./obligations/draft-rules/index.ts";

export const AGENCY_SETUP_PATH = "/dashboard/settings/compliance-setup" as const;

export const AGENCY_SETUP_INCOMPLETE_MESSAGE =
  "Agency setup is incomplete. Answer the required operating questions before creating staff or clients.";

export const REQUIRED_SETUP_FACT_KEYS = [
  AWARDED_SERVICE_CODES_FACT_KEY,
  "operates_ol_site",
  "uses_volunteers",
  "has_governing_board",
  "approx_client_count",
  "service_area",
] as const;

export type RequiredSetupFactKey = (typeof REQUIRED_SETUP_FACT_KEYS)[number];

export type AgencySetupFacts = OrgFacts & {
  approxClientCount: number | null;
  serviceArea: string | null;
};

export const EMPTY_AGENCY_SETUP_FACTS: AgencySetupFacts = {
  ...EMPTY_ORG_FACTS,
  approxClientCount: null,
  serviceArea: null,
};

export type RequiredSetupQuestion = {
  key: RequiredSetupFactKey;
  question: string;
  help: string;
};

export const REQUIRED_SETUP_QUESTIONS: RequiredSetupQuestion[] = [
  {
    key: AWARDED_SERVICE_CODES_FACT_KEY,
    question: "Which DSPD service codes is this contractor awarded?",
    help: "Record at least one awarded code. Empty is unanswered — not known-none.",
  },
  {
    key: "operates_ol_site",
    question: "Does this contractor operate an OL-licensed or OL-certified site?",
    help: ORG_FACT_DEFINITIONS.find((d) => d.key === "operates_ol_site")?.help ?? "",
  },
  {
    key: "uses_volunteers",
    question: "Does this contractor use regularly scheduled volunteers?",
    help: ORG_FACT_DEFINITIONS.find((d) => d.key === "uses_volunteers")?.help ?? "",
  },
  {
    key: "has_governing_board",
    question: "Does this contractor have a governing or policy-making board?",
    help: ORG_FACT_DEFINITIONS.find((d) => d.key === "has_governing_board")?.help ?? "",
  },
  {
    key: "approx_client_count",
    question: "Approximately how many clients does this contractor serve?",
    help: "A recorded count, including zero. Blank is unanswered.",
  },
  {
    key: "service_area",
    question: "Which counties or service area does this contractor cover?",
    help: "A recorded service area. Blank is unanswered.",
  },
];

export type AgencySetupStatus = {
  complete: boolean;
  answeredCount: number;
  requiredCount: number;
  unanswered: RequiredSetupQuestion[];
  answeredKeys: RequiredSetupFactKey[];
  progressLabel: string;
  message: string | null;
};

export const SETUP_GATED_PATHS = [
  "/dashboard/employees",
  "/dashboard/employees/new",
  "/dashboard/hub/employees",
  "/dashboard/clients",
  "/dashboard/clients/new",
  "/dashboard/hub/clients",
  "/employees/new",
  "/employees",
  "/clients/new",
  "/clients",
] as const;

export const SETUP_CREATE_APIS = [
  "createEmployeeManually",
  "hireEmployeeInternal",
  "applyEmployeeRosterRow",
  "createInvitation",
  "clients.insert",
  "smartImportCommitClient",
  "smartImportCommitStaff",
] as const;

const SERVICE_AREA_PREFIX = "Service area:";

export function parseServiceAreaFromSpecializations(
  specializations: string | null | undefined,
): string | null {
  if (!specializations) return null;
  const match = specializations.match(/^Service area:\s*(.+)$/m);
  const value = match?.[1]?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function mergeServiceAreaIntoSpecializations(
  specializations: string | null | undefined,
  serviceArea: string | null | undefined,
): string | null {
  const other = (specializations ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^Service area:/i.test(line));
  const area = (serviceArea ?? "").trim();
  if (area) other.push(`${SERVICE_AREA_PREFIX} ${area}`);
  return other.length ? other.join("\n") : null;
}

export function parseApproxCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

function isFactAnswered(key: RequiredSetupFactKey, facts: AgencySetupFacts): boolean {
  switch (key) {
    case AWARDED_SERVICE_CODES_FACT_KEY:
      return !awardedCodesUnanswered(facts.servicesOffered);
    case "operates_ol_site":
    case "uses_volunteers":
    case "has_governing_board":
      return facts[key] === true || facts[key] === false;
    case "approx_client_count":
      return facts.approxClientCount !== null;
    case "service_area":
      return Boolean(facts.serviceArea && facts.serviceArea.trim().length > 0);
    default:
      return false;
  }
}

export function computeAgencySetupStatus(facts: AgencySetupFacts): AgencySetupStatus {
  const unanswered = REQUIRED_SETUP_QUESTIONS.filter((q) => !isFactAnswered(q.key, facts));
  const answeredKeys = REQUIRED_SETUP_QUESTIONS.filter((q) => isFactAnswered(q.key, facts)).map(
    (q) => q.key,
  );
  const answeredCount = answeredKeys.length;
  const requiredCount = REQUIRED_SETUP_QUESTIONS.length;
  const complete = unanswered.length === 0;
  return {
    complete,
    answeredCount,
    requiredCount,
    unanswered,
    answeredKeys,
    progressLabel: `${answeredCount} of ${requiredCount}`,
    message: complete ? null : AGENCY_SETUP_INCOMPLETE_MESSAGE,
  };
}

export function canSkipAgencySetup(status: AgencySetupStatus): boolean {
  return status.complete;
}

export function shouldBlockStaffClientCreate(status: AgencySetupStatus): boolean {
  return !status.complete;
}

export function assertAgencySetupComplete(status: AgencySetupStatus): void {
  if (!status.complete) {
    throw new Error(AGENCY_SETUP_INCOMPLETE_MESSAGE);
  }
}

export function isSetupGatedPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  return SETUP_GATED_PATHS.some((gated) => path === gated || path.startsWith(`${gated}/`));
}

export function isDashboardHomePath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  return path === "/dashboard";
}

export function setupRedirectForPath(
  pathname: string,
  status: AgencySetupStatus,
): { to: typeof AGENCY_SETUP_PATH; search: { reason: string } } | null {
  if (status.complete) return null;
  if (!isSetupGatedPath(pathname)) return null;
  return {
    to: AGENCY_SETUP_PATH,
    search: { reason: "setup_incomplete" },
  };
}

export type OrgAccessActor = {
  userId: string;
  organizationId: string;
  role?: string | null;
};

export function canAccessOrgResource(input: {
  actor: OrgAccessActor | null | undefined;
  resourceOrganizationId: string;
}): boolean {
  if (!input.actor?.userId || !input.actor.organizationId) return false;
  return input.actor.organizationId === input.resourceOrganizationId;
}

export function canViewAgencySetup(input: {
  actor: OrgAccessActor | null | undefined;
  organizationId: string;
}): boolean {
  return canAccessOrgResource({ actor: input.actor, resourceOrganizationId: input.organizationId });
}

export function canModifyAgencySetup(input: {
  actor: OrgAccessActor | null | undefined;
  organizationId: string;
}): boolean {
  if (!canViewAgencySetup(input)) return false;
  const role = input.actor?.role ?? "";
  return role === "admin" || role === "program_manager" || role === "manager";
}

export function isolateOrgRecords<T extends { organizationId: string }>(
  actor: OrgAccessActor | null | undefined,
  rows: T[],
): T[] {
  if (!actor?.organizationId) return [];
  return rows.filter((row) => row.organizationId === actor.organizationId);
}

export type AgencyRequirementSnapshot = {
  organizationId: string;
  applicability: ObligationApplicability[];
  draft: SimulationResult;
  activatedRules: boolean;
  canActivateAny: boolean;
};

export function reevaluateAgencyRequirements(input: {
  organizationId: string;
  facts: AgencySetupFacts;
  staff?: SyntheticStaff[];
  now?: Date;
}): AgencyRequirementSnapshot {
  const applicability = computeObligationApplicability(input.facts);
  const draft = simulateDraftRules({
    rules: CORE_RULE_LOGIC_SLICE,
    orgFacts: input.facts,
    staff: input.staff ?? [],
    evidence: [],
    now: input.now ?? new Date("2026-09-14T12:00:00.000Z"),
    orgHasAcreCoverage: null,
    organizationId: input.organizationId,
  });
  const canActivateAny = CORE_RULE_LOGIC_SLICE.some((rule) => canActivate(rule));
  return {
    organizationId: input.organizationId,
    applicability,
    draft,
    activatedRules: draft.activatedRules,
    canActivateAny,
  };
}

export function orgFactsFromSetup(facts: AgencySetupFacts): OrgFacts {
  return {
    operates_ol_site: facts.operates_ol_site,
    uses_volunteers: facts.uses_volunteers,
    has_governing_board: facts.has_governing_board,
    servicesOffered: facts.servicesOffered,
  };
}

export function setupFactsFromOrgRow(row: {
  fact_operates_ol_site?: unknown;
  fact_uses_volunteers?: unknown;
  fact_has_governing_board?: unknown;
  services_offered?: unknown;
  approx_client_count?: unknown;
  specializations?: unknown;
}): AgencySetupFacts {
  const services = Array.isArray(row.services_offered)
    ? row.services_offered.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
    : [];
  return {
    operates_ol_site: parseFactAnswer(row.fact_operates_ol_site),
    uses_volunteers: parseFactAnswer(row.fact_uses_volunteers),
    has_governing_board: parseFactAnswer(row.fact_has_governing_board),
    servicesOffered: services,
    approxClientCount: parseApproxCount(row.approx_client_count),
    serviceArea: parseServiceAreaFromSpecializations(
      typeof row.specializations === "string" ? row.specializations : null,
    ),
  };
}

export function factAnswerOrNull(value: FactAnswer): FactAnswer {
  return value === true || value === false ? value : null;
}
