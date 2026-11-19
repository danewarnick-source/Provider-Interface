// The home page's resident facts (loadHomeResidents), refreshed with every
// away-time change ("home-residents"). Residents themselves come from the
// board's coverage data, so the page and the bars agree on who lives here.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadHomeResidents } from "@/lib/scheduler/home-residents-load";

export type { HomeResidents } from "@/lib/scheduler/home-residents-load";

export function useHomeResidents(orgId: string, teamId: string, ids: string[]) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["home-residents", orgId, teamId, ids.join()],
    queryFn: () => loadHomeResidents(supabase, orgId, ids),
  });
}
