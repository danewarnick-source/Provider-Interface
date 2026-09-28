import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useCurrentOrg } from "./use-org";
import { buildAssignmentMap, type AssignmentMap } from "@/lib/assignment-codes";

export {
  allowedCodesFor,
  buildAssignmentMap,
  caseloadCardActions,
  caseloadDailyNoteLabel,
  caseloadTimeClockLabel,
  clientAuthorizedCodes,
  defaultCaseloadCode,
  firstClockableCode,
  hasHhsCode,
  hasHostHomeDailyCode,
  hostHomeDailyNoteCode,
  isDualHhsAndClockable,
  isHostHomeDailyNoteCard,
  isHostHomeOnlyAssignment,
  stackDualCaseloadActions,
  type AssignmentMap,
} from "@/lib/assignment-codes";

/**
 * Per-staff caseload assignments scoped to explicit service codes.
 *
 * Every `staff_assignments` row lists its codes. Rows with NULL or [] codes
 * contribute nothing (never "all codes"); duplicate rows for one client
 * merge their codes. The map is keyed by client_id; clients with no codes
 * are absent. While loading, `data` is undefined and allowedCodesFor
 * returns [] — nothing is shown instead of everything.
 */
export function useMyAssignments() {
  const { user } = useAuth();
  const { data: org } = useCurrentOrg();
  return useQuery({
    enabled: !!user?.id && !!org?.organization_id,
    queryKey: ["my-assignments", org?.organization_id, user?.id],
    queryFn: async (): Promise<AssignmentMap> => {
      const { data, error } = await supabase
        .from("staff_assignments")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("client_id, service_codes" as any)
        .eq("organization_id", org!.organization_id)
        .eq("staff_id", user!.id);
      if (error) throw error;
      return buildAssignmentMap(
        ((data ?? []) as unknown) as Array<{ client_id: string; service_codes: string[] | null }>,
      );
    },
  });
}
