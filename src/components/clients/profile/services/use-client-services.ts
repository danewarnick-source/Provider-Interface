// Services & billing data for one client, and the refresh after a change.
// Authorization changes ripple into codes (scheduler, caseload, list,
// overview), so every query that reads codes is refreshed.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientServices } from "@/lib/clients/services.functions";

export const clientServicesKey = (clientId: string) => ["client-services", clientId] as const;

const CODE_KEYS = [
  "client-profile-codes",
  "client-active-codes",
  "client-profile",
  "all-client-billing-codes",
  "client-billing-codes",
  "client-budget",
  "client-overview",
  "client-file-cards",
  "caseload",
  "scheduler-data",
];

export function useClientServices(orgId: string, clientId: string) {
  const fn = useServerFn(getClientServices);
  return useQuery({
    queryKey: clientServicesKey(clientId),
    enabled: !!orgId && !!clientId,
    queryFn: () => fn({ data: { organizationId: orgId, clientId } }),
  });
}

export function useRefreshServices(clientId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clientServicesKey(clientId) });
    for (const key of CODE_KEYS) void qc.invalidateQueries({ queryKey: [key] });
  };
}
