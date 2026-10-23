// One client's setup answers (client_support_scope) and the save that goes
// through saveClientSupportScope. Saving refreshes the profile and Overview.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveClientSupportScope } from "@/lib/clients/support-scope.functions";
import {
  SUPPORT_SCOPE_COLUMNS,
  type ScopeAnswers,
  type SupportScope,
} from "@/lib/clients/support-scope";

export const supportScopeKey = (clientId: string) => ["client-support-scope", clientId] as const;

export function useSupportScope(clientId: string) {
  return useQuery({
    queryKey: supportScopeKey(clientId),
    queryFn: async (): Promise<SupportScope | null> => {
      const { data, error } = await supabase
        .from("client_support_scope")
        .select(SUPPORT_SCOPE_COLUMNS)
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SupportScope | null) ?? null;
    },
    staleTime: 30_000,
  });
}

export function useSaveSupportScope(orgId: string, clientId: string) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveClientSupportScope);
  return useMutation({
    mutationFn: (v: { answers: ScopeAnswers; finished?: boolean }) =>
      saveFn({ data: { organizationId: orgId, clientId, ...v } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: supportScopeKey(clientId) });
      void qc.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
