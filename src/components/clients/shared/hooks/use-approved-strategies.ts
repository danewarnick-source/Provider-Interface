import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRouteUuid } from "@/lib/route-uuid";
import { approvedStrategies, type ApprovedStrategy } from "@/lib/clients/shift-focus";
import type { CSTContent } from "@/lib/clients/training.functions";

/**
 * A client's APPROVED support strategy bullets (RLS: the team who can see the
 * client reads published strategies; drafts stay admin-only). Empty when
 * none are approved, so staff then see goals and supports only.
 */
export function useApprovedStrategies(clientId: string | null | undefined) {
  return useQuery({
    enabled: isRouteUuid(clientId),
    queryKey: ["approved-support-strategies", clientId],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ApprovedStrategy[]> => {
      const { data, error } = await supabase
        .from("client_specific_trainings")
        .select("status, approved_at, content")
        .eq("client_id", clientId!)
        .eq("training_type", "support_strategies")
        .eq("status", "published")
        .maybeSingle();
      if (error) return [];
      return approvedStrategies(
        data as { status: string; approved_at: string | null; content: CSTContent | null } | null,
      );
    },
  });
}
