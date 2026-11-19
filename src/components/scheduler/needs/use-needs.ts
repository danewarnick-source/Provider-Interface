// The Needs you list (loadNeedsYou, lib/scheduler/needs.functions.ts), shared
// by the page, the board banner and the Scheduler menu count: one query, so
// the three always agree. Every change on the board or in Needs you
// invalidates ["needs-you"].
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadNeedsYou } from "@/lib/scheduler/needs.functions";
import type { NeedItem } from "@/lib/scheduler/needs-items";

export function useNeeds(orgId: string | undefined, enabled = true) {
  const run = useServerFn(loadNeedsYou);
  return useQuery({
    enabled: !!orgId && enabled,
    queryKey: ["needs-you", orgId],
    queryFn: (): Promise<NeedItem[]> => run({ data: { organization_id: orgId! } }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
