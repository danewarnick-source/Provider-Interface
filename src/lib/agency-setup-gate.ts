/**
 * Agency setup gate — server-authoritative completion from saved facts.
 * Staff and client creation stay closed until every required operating
 * question has a recorded answer. Banner math is display-only.
 */

import { AWARDED_SERVICE_CODES_FACT_KEY } from "./obligations/setup-facts.ts";
import {
  ORG_FACT_DEFINITIONS,
  computeObligationApplicability,
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
import {
  AGENCY_SETUP_COMPLETION_SPEC,
  factsAreComplete,
  isRequiredSetupFactAnswered,
  type AgencySetupFacts,
} from "./agency-setup-completion.ts";
import { isAdminLevel } from "./access/levels.ts";

export {
  AGENCY_SETUP_COMPLETION_SPEC,
  EMPTY_AGENCY_SETUP_FACTS,
  factAnswerOrNull,
  parseApproxCount,
  parseServiceAreaColumn,
  setupFactsFromOrgRow,
  type AgencySetupFacts,
} from "./agency-setup-completion.ts";

export const AGENCY_SETUP_PATH = "/dashboard/settings/compliance-setup" as const;

export const AGENCY_SETUP_INCOMPLETE_MESSAGE =
  "Agency setup is incomplete. Answer the required operating questions before creating staff or clients.";

export const REQUIRED_SETUP_FACT_KEYS = AGENCY_SETUP_COMPLETION_SPEC.requiredFacts.map(
  (fact) => fact.key,
) as unknown as readonly [
  typeof AWARDED_SERVICE_CODES_FACT_KEY,
  "operates_ol_site",
  "uses_volunteers",
  "has_governing_board",
  "approx_client_count",
  "service_area",
];

export type RequiredSetupFactKey = (typeof REQUIRED_SETUP_FACT_KEYS)[number];

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
  /** One-time SQL snapshot: org already had staff/clients when the gate landed. */
  createGateExempt: boolean;
  /** complete OR createGateExempt — the create/invite/redirect authority. */
  createAllowed: boolean;
};

export type ComputeAgencySetupStatusOptions = {
  createGateExempt?: boolean;
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

export function computeAgencySetupStatus(
  facts: AgencySetupFacts,
  options: ComputeAgencySetupStatusOptions = {},
): AgencySetupStatus {
  const unanswered = REQUIRED_SETUP_QUESTIONS.filter(
    (q) => !isRequiredSetupFactAnswered(q.key, facts),
  );
  const answeredKeys = REQUIRED_SETUP_QUESTIONS.filter((q) =>
    isRequiredSetupFactAnswered(q.key, facts),
  ).map((q) => q.key);
  const answeredCount = answeredKeys.length;
  const requiredCount = REQUIRED_SETUP_QUESTIONS.length;
  const complete = unanswered.length === 0 && factsAreComplete(facts);
  const createGateExempt = options.createGateExempt === true;
  return {
    complete,
    answeredCount,
    requiredCount,
    unanswered,
    answeredKeys,
    progressLabel: `${answeredCount} of ${requiredCount}`,
    message: complete ? null : AGENCY_SETUP_INCOMPLETE_MESSAGE,
    createGateExempt,
    createAllowed: complete || createGateExempt,
  };
}

export function canSkipAgencySetup(status: AgencySetupStatus): boolean {
  return status.complete;
}

export function shouldBlockStaffClientCreate(status: AgencySetupStatus): boolean {
  return !status.createAllowed;
}

export function assertAgencySetupComplete(status: AgencySetupStatus): void {
  if (!status.createAllowed) {
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
  if (status.createAllowed) return null;
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
  return isAdminLevel(role);
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
