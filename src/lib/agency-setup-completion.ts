/**
 * Canonical agency-setup completion — shared by TypeScript and SQL.
 *
 * SQL twin: public.org_setup_is_complete(uuid) in
 * supabase/migrations/20260914120000_agency_setup_gate.sql
 *
 * Six required facts. Same answered semantics on both sides.
 * Never read `specializations` for the gate. Service area is
 * organizations.service_area only:
 *   service_area IS NOT NULL AND length(trim(service_area)) > 0
 */

import {
  AWARDED_SERVICE_CODES_FACT_KEY,
  awardedCodesUnanswered,
} from "./obligations/setup-facts.ts";
import { parseFactAnswer, type FactAnswer, type OrgFacts } from "./obligations/applicability.ts";

export const AGENCY_SETUP_COMPLETION_SPEC = {
  version: 1,
  requiredFacts: [
    {
      key: AWARDED_SERVICE_CODES_FACT_KEY,
      sqlColumn: "services_offered",
      answeredWhen: "cardinality of trimmed nonempty codes > 0",
    },
    {
      key: "operates_ol_site",
      sqlColumn: "fact_operates_ol_site",
      answeredWhen: "IS NOT NULL (true or false)",
    },
    {
      key: "uses_volunteers",
      sqlColumn: "fact_uses_volunteers",
      answeredWhen: "IS NOT NULL (true or false)",
    },
    {
      key: "has_governing_board",
      sqlColumn: "fact_has_governing_board",
      answeredWhen: "IS NOT NULL (true or false)",
    },
    {
      key: "approx_client_count",
      sqlColumn: "approx_client_count",
      answeredWhen: "IS NOT NULL",
    },
    {
      key: "service_area",
      sqlColumn: "service_area",
      answeredWhen: "IS NOT NULL AND length(trim(service_area)) > 0",
    },
  ],
} as const;

export type AgencySetupFacts = OrgFacts & {
  approxClientCount: number | null;
  serviceArea: string | null;
};

export const EMPTY_AGENCY_SETUP_FACTS: AgencySetupFacts = {
  operates_ol_site: null,
  uses_volunteers: null,
  has_governing_board: null,
  servicesOffered: [],
  approxClientCount: null,
  serviceArea: null,
};

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

export function parseServiceAreaColumn(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function setupFactsFromOrgRow(row: {
  fact_operates_ol_site?: unknown;
  fact_uses_volunteers?: unknown;
  fact_has_governing_board?: unknown;
  services_offered?: unknown;
  approx_client_count?: unknown;
  service_area?: unknown;
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
    serviceArea: parseServiceAreaColumn(row.service_area),
  };
}

export function isRequiredSetupFactAnswered(
  key: (typeof AGENCY_SETUP_COMPLETION_SPEC.requiredFacts)[number]["key"],
  facts: AgencySetupFacts,
): boolean {
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

export function factsAreComplete(facts: AgencySetupFacts): boolean {
  return AGENCY_SETUP_COMPLETION_SPEC.requiredFacts.every((fact) =>
    isRequiredSetupFactAnswered(fact.key, facts),
  );
}

export function factAnswerOrNull(value: FactAnswer): FactAnswer {
  return value === true || value === false ? value : null;
}
