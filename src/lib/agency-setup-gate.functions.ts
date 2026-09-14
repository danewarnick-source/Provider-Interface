import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { persistOrgFacts, type PersistOrgFactsInput } from "@/lib/obligations/applicability";
import { canActivate } from "@/lib/obligations/draft-rules/publication";
import {
  AGENCY_SETUP_INCOMPLETE_MESSAGE,
  computeAgencySetupStatus,
  EMPTY_AGENCY_SETUP_FACTS,
  mergeServiceAreaIntoSpecializations,
  parseApproxCount,
  reevaluateAgencyRequirements,
  setupFactsFromOrgRow,
  type AgencySetupFacts,
  type AgencySetupStatus,
} from "@/lib/agency-setup-gate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function columnsMissing(message: string | undefined): boolean {
  return !!message && /does not exist|schema cache|column|could not find/i.test(message);
}

export async function loadAgencySetupFacts(
  supabase: AnySupabase,
  organizationId: string,
): Promise<AgencySetupFacts> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "fact_operates_ol_site, fact_uses_volunteers, fact_has_governing_board, services_offered, approx_client_count, specializations",
    )
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
  const facts = await loadAgencySetupFacts(supabase, organizationId);
  return computeAgencySetupStatus(facts);
}

export async function assertAgencySetupCompleteForOrg(
  supabase: AnySupabase,
  organizationId: string,
): Promise<AgencySetupStatus> {
  const status = await loadAgencySetupStatus(supabase, organizationId);
  if (!status.complete) {
    throw new Error(AGENCY_SETUP_INCOMPLETE_MESSAGE);
  }
  return status;
}

export type PersistAgencySetupInput = PersistOrgFactsInput & {
  approxClientCount?: number | null;
  serviceArea?: string | null;
};

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
  const { data: existing, error: readErr } = await supabase
    .from("organizations")
    .select("specializations, approx_client_count")
    .eq("id", organizationId)
    .maybeSingle();
  if (readErr && !columnsMissing(readErr.message)) throw new Error(readErr.message);

  const persisted = await persistOrgFacts(supabase, organizationId, userId, answers);

  const nextArea =
    answers.serviceArea !== undefined
      ? answers.serviceArea
      : undefined;
  const nextCount =
    answers.approxClientCount !== undefined
      ? parseApproxCount(answers.approxClientCount)
      : parseApproxCount(existing?.approx_client_count);
  const specializations =
    nextArea !== undefined
      ? mergeServiceAreaIntoSpecializations(
          typeof existing?.specializations === "string" ? existing.specializations : null,
          nextArea,
        )
      : undefined;

  if (nextArea !== undefined || answers.approxClientCount !== undefined) {
    const { error: extraErr } = await supabase
      .from("organizations")
      .update({
        ...(answers.approxClientCount !== undefined ? { approx_client_count: nextCount } : {}),
        ...(specializations !== undefined ? { specializations } : {}),
      })
      .eq("id", organizationId);
    if (extraErr && !columnsMissing(extraErr.message)) throw new Error(extraErr.message);
  }

  const facts = await loadAgencySetupFacts(supabase, organizationId);
  const snapshot = reevaluateAgencyRequirements({
    organizationId,
    facts,
  });
  void persisted;
  if (snapshot.canActivateAny || snapshot.draft.activatedRules) {
    throw new Error("Draft catalog rules cannot activate from setup re-evaluation.");
  }
  void canActivate;
  return {
    facts,
    status: computeAgencySetupStatus(facts),
    activatedRules: snapshot.activatedRules,
    canActivateAny: snapshot.canActivateAny,
  };
}

const OrgId = z.object({ organizationId: z.string().uuid() });

const PersistInput = z.object({
  organizationId: z.string().uuid(),
  operates_ol_site: z.union([z.boolean(), z.null()]),
  uses_volunteers: z.union([z.boolean(), z.null()]),
  has_governing_board: z.union([z.boolean(), z.null()]),
  servicesOffered: z.array(z.string()).optional(),
  approxClientCount: z.number().int().min(0).nullable().optional(),
  serviceArea: z.string().max(200).nullable().optional(),
});

export const getAgencySetupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => OrgId.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    if (!supabase || !context.userId) {
      return {
        ...computeAgencySetupStatus(EMPTY_AGENCY_SETUP_FACTS),
        organizationId: data.organizationId,
        facts: EMPTY_AGENCY_SETUP_FACTS,
      };
    }
    await requireOrgMembership(supabase, context.userId, data.organizationId, "employee");
    const facts = await loadAgencySetupFacts(supabase, data.organizationId);
    const status = computeAgencySetupStatus(facts);
    return { ...status, organizationId: data.organizationId, facts };
  });

export const persistAgencySetupFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PersistInput.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    if (!supabase || !context.userId) throw new Error("Not authenticated");
    await requireOrgMembership(supabase, context.userId, data.organizationId, "manager");
    const { organizationId, ...answers } = data;
    return persistAgencySetupFactsInternal(supabase, organizationId, context.userId, answers);
  });
