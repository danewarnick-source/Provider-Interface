// The client's team: staff_assignments rows (who works which codes), the
// client's active codes, and the open do-not-schedule list.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadActiveCodes } from "@/lib/clients/codes";
import { assignmentCodes } from "@/lib/assignment-codes";

export type TeamExclusion = {
  id: string;
  staff_user_id: string;
  reason: string;
  created_at: string;
};

export type ClientTeam = {
  /** staff id → the explicit codes assigned. */
  assigned: Map<string, string[]>;
  codes: string[];
  exclusions: TeamExclusion[];
};

const clientTeamKey = (orgId: string, clientId: string) =>
  ["client-team", orgId, clientId] as const;

export function useClientTeam(orgId: string, clientId: string) {
  return useQuery({
    queryKey: clientTeamKey(orgId, clientId),
    queryFn: async (): Promise<ClientTeam> => {
      const [a, codes, x] = await Promise.all([
        supabase
          .from("staff_assignments")
          .select("staff_id, service_codes")
          .eq("organization_id", orgId)
          .eq("client_id", clientId),
        loadActiveCodes(supabase, [clientId]),
        supabase
          .from("client_staff_exclusions")
          .select("id, staff_user_id, reason, created_at")
          .eq("organization_id", orgId)
          .eq("client_id", clientId)
          .is("ended_at", null)
          .order("created_at", { ascending: false }),
      ]);
      if (a.error) throw a.error;
      if (x.error) throw x.error;
      const assigned = new Map<string, string[]>();
      for (const r of (a.data ?? []) as Array<{
        staff_id: string;
        service_codes: string[] | null;
      }>) {
        assigned.set(r.staff_id, assignmentCodes(r.service_codes));
      }
      return {
        assigned,
        codes: codes.get(clientId) ?? [],
        exclusions: (x.data ?? []) as TeamExclusion[],
      };
    },
  });
}
