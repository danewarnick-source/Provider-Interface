import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-org";
import { getAgencySetupStatus } from "@/lib/agency-setup-gate.functions";
import {
  computeAgencySetupStatus,
  EMPTY_AGENCY_SETUP_FACTS,
  type AgencySetupFacts,
  type AgencySetupStatus,
} from "@/lib/agency-setup-gate";

export function agencySetupQueryKey(orgId: string | null | undefined) {
  return ["agency-setup-status", orgId] as const;
}

export function useAgencySetup() {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id ?? null;
  const loadStatus = useServerFn(getAgencySetupStatus);

  const query = useQuery({
    queryKey: agencySetupQueryKey(orgId),
    enabled: !!orgId,
    queryFn: async (): Promise<
      AgencySetupStatus & { organizationId: string; facts: AgencySetupFacts }
    > => {
      if (!orgId) {
        return {
          ...computeAgencySetupStatus(EMPTY_AGENCY_SETUP_FACTS),
          organizationId: "",
          facts: EMPTY_AGENCY_SETUP_FACTS,
        };
      }
      return loadStatus({ data: { organizationId: orgId } });
    },
  });

  const status = query.data ?? computeAgencySetupStatus(EMPTY_AGENCY_SETUP_FACTS);
  return {
    org,
    orgId,
    status,
    facts: query.data?.facts ?? EMPTY_AGENCY_SETUP_FACTS,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
