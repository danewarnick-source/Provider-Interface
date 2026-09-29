import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMemberCaseload } from "@/lib/team-members/caseload.functions";
import { teamMemberCaseloadQueryKey } from "@/lib/team-members/caseload";

/** Shared by the Caseload tab and the header "Ready alone" badge (same query key). */
export function useMemberCaseload(orgId: string | null | undefined, staffId: string) {
  const loadFn = useServerFn(getMemberCaseload);
  return useQuery({
    enabled: !!orgId,
    queryKey: teamMemberCaseloadQueryKey(orgId, staffId),
    queryFn: () => loadFn({ data: { organizationId: orgId!, staffId } }),
  });
}
