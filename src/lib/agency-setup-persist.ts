/**
 * Agency setup persist / load — no @/ aliases so Node tests can import it.
 */
import {
  computeObligationApplicability,
  persistApplicabilityRows,
  type PersistOrgFactsInput,
} from "./obligations/applicability.ts";
import { canActivate } from "./obligations/draft-rules/publication.ts";
import {
  AGENCY_SETUP_INCOMPLETE_MESSAGE,
  computeAgencySetupStatus,
  EMPTY_AGENCY_SETUP_FACTS,
  parseApproxCount,
  parseServiceAreaColumn,
  reevaluateAgencyRequirements,
  setupFactsFromOrgRow,
  type AgencySetupFacts,
  type AgencySetupStatus,
} from "./agency-setup-gate.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const SETUP_ORG_COLUMNS =
  "fact_operates_ol_site, fact_uses_volunteers, fact_has_governing_board, services_offered, approx_client_count, service_area, setup_create_gate_exempt";

type OrgSetupSnapshot = {
  fact_operates_ol_site: unknown;
  fact_uses_volunteers: unknown;
  fact_has_governing_board: unknown;
  services_offered: unknown;
  approx_client_count: unknown;
  service_area: unknown;
  setup_create_gate_exempt?: unknown;
  fact_answers_updated_at?: unknown;
  fact_answers_updated_by?: unknown;
};

export function columnsMissing(message: string | undefined): boolean {
  return !!message && /does not exist|schema cache|column|could not find/i.test(message);
}

function createGateExemptFromRow(row: { setup_create_gate_exempt?: unknown } | null): boolean {
  return row?.setup_create_gate_exempt === true;
}

export async function loadAgencySetupFacts(
  supabase: AnySupabase,
  organizationId: string,
): Promise<AgencySetupFacts> {
  const { data, error } = await supabase
    .from("organizations")
    .select(SETUP_ORG_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle();
  if (error) {
    if (columnsMissing(error.message)) return { ...EMPTY_AGENCY_SETUP_FACTS };
    throw new Error(error.message);
  }
  if (!data) return { ...EMPTY_AGENCY_SETUP_FACTS };
  return setupFactsFromOrgRow(data);
}

export async function loadAgencySetupStatus(
  supabase: AnySupabase,
  organizationId: string,
): Promise<AgencySetupStatus> {
  const { data, error } = await supabase
    .from("organizations")
    .select(SETUP_ORG_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle();
  if (error) {
    if (columnsMissing(error.message)) {
      return computeAgencySetupStatus({ ...EMPTY_AGENCY_SETUP_FACTS });
    }
    throw new Error(error.message);
  }
  if (!data) return computeAgencySetupStatus({ ...EMPTY_AGENCY_SETUP_FACTS });
  return computeAgencySetupStatus(setupFactsFromOrgRow(data), {
    createGateExempt: createGateExemptFromRow(data),
  });
}

export async function assertAgencySetupCompleteForOrg(
  supabase: AnySupabase,
  organizationId: string,
): Promise<AgencySetupStatus> {
  const status = await loadAgencySetupStatus(supabase, organizationId);
  if (!status.createAllowed) {
    throw new Error(AGENCY_SETUP_INCOMPLETE_MESSAGE);
  }
  return status;
}

export type PersistAgencySetupInput = PersistOrgFactsInput & {
  approxClientCount?: number | null;
  serviceArea?: string | null;
};

async function readOrgSetupSnapshot(
  supabase: AnySupabase,
  organizationId: string,
): Promise<OrgSetupSnapshot | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(`${SETUP_ORG_COLUMNS}, fact_answers_updated_at, fact_answers_updated_by`)
    .eq("id", organizationId)
    .maybeSingle();
  if (error && !columnsMissing(error.message)) throw new Error(error.message);
  return data ?? null;
}

/**
 * One organizations UPDATE for all six facts. If a later step fails,
 * restore the snapshot so a partial save does not stick.
 */
export async function persistAgencySetupFactsInternal(
  supabase: AnySupabase,
  organizationId: string,
  userId: string,
  answers: PersistAgencySetupInput,
): Promise<{
  facts: AgencySetupFacts;
  status: AgencySetupStatus;
  activatedRules: boolean;
  canActivateAny: boolean;
}> {
  const existing = await readOrgSetupSnapshot(supabase, organizationId);
  const existingFacts = existing ? setupFactsFromOrgRow(existing) : { ...EMPTY_AGENCY_SETUP_FACTS };

  const nextServices =
    answers.servicesOffered !== undefined
      ? answers.servicesOffered.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
      : existingFacts.servicesOffered;
  const nextCount =
    answers.approxClientCount !== undefined
      ? parseApproxCount(answers.approxClientCount)
      : existingFacts.approxClientCount;
  const nextArea =
    answers.serviceArea !== undefined
      ? parseServiceAreaColumn(answers.serviceArea)
      : existingFacts.serviceArea;

  const orgUpdate = {
    fact_operates_ol_site: answers.operates_ol_site,
    fact_uses_volunteers: answers.uses_volunteers,
    fact_has_governing_board: answers.has_governing_board,
    ...(answers.servicesOffered !== undefined ? { services_offered: nextServices } : {}),
    ...(answers.approxClientCount !== undefined ? { approx_client_count: nextCount } : {}),
    ...(answers.serviceArea !== undefined ? { service_area: nextArea } : {}),
    fact_answers_updated_at: new Date().toISOString(),
    fact_answers_updated_by: userId,
  };

  const { error: updateErr } = await supabase
    .from("organizations")
    .update(orgUpdate)
    .eq("id", organizationId);
  if (updateErr) {
    if (columnsMissing(updateErr.message)) {
      throw new Error(
        "Agency setup columns are not live yet. Soft Core must apply the setup-gate SQL first.",
      );
    }
    throw new Error(updateErr.message);
  }

  const factsForApplicability: AgencySetupFacts = {
    operates_ol_site: answers.operates_ol_site,
    uses_volunteers: answers.uses_volunteers,
    has_governing_board: answers.has_governing_board,
    servicesOffered: nextServices,
    approxClientCount: nextCount,
    serviceArea: nextArea,
  };

  try {
    const applicability = computeObligationApplicability(factsForApplicability);
    await persistApplicabilityRows(supabase, organizationId, userId, applicability);
  } catch (laterErr) {
    if (existing) {
      const { error: restoreErr } = await supabase
        .from("organizations")
        .update({
          fact_operates_ol_site: existing.fact_operates_ol_site ?? null,
          fact_uses_volunteers: existing.fact_uses_volunteers ?? null,
          fact_has_governing_board: existing.fact_has_governing_board ?? null,
          services_offered: existing.services_offered,
          approx_client_count: existing.approx_client_count,
          service_area: existing.service_area,
          fact_answers_updated_at: existing.fact_answers_updated_at ?? null,
          fact_answers_updated_by: existing.fact_answers_updated_by ?? null,
        })
        .eq("id", organizationId);
      if (restoreErr && !columnsMissing(restoreErr.message)) {
        throw new Error(`Agency setup save failed and rollback failed: ${restoreErr.message}`);
      }
    }
    throw laterErr;
  }

  const facts = await loadAgencySetupFacts(supabase, organizationId);
  const snapshot = reevaluateAgencyRequirements({
    organizationId,
    facts,
  });
  if (snapshot.canActivateAny || snapshot.draft.activatedRules) {
    throw new Error("Draft catalog rules cannot activate from setup re-evaluation.");
  }
  void canActivate;
  return {
    facts,
    status: computeAgencySetupStatus(facts, {
      createGateExempt: createGateExemptFromRow(existing),
    }),
    activatedRules: snapshot.activatedRules,
    canActivateAny: snapshot.canActivateAny,
  };
}
