// Loads the Scheduling settings once per agency (loadSchedulingSettings), for
// the Settings screen and the "Settings for <home>" card.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/hooks/use-org";
import { loadSchedulingSettings } from "@/lib/scheduler/settings/settings.functions";

export function useSchedulingSettings() {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const load = useServerFn(loadSchedulingSettings);
  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["scheduling-settings", orgId],
    queryFn: () => load({ data: { organizationId: orgId! } }),
  });
  return { orgId, ...q };
}
