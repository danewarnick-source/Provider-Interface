// The clients columns behind the Health section (Client medical: View),
// plus a save helper that patches them through updateClient.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { updateClient } from "@/lib/clients/writes.functions";

const HEALTH_COLUMNS =
  "id, allergies, diagnoses, chronic_conditions, dysphagia, swallowing_alerts, dnr_status, dnr_location, polst_status, palliative_care_status, hospice_status, advance_directive_notes, emergency_medical_treatment_authorization, self_admin_med_support, has_abi";

export type ClientHealthRow = {
  id: string;
  allergies: string[] | null;
  diagnoses: string[] | null;
  chronic_conditions: string[] | null;
  dysphagia: boolean | null;
  swallowing_alerts: string[] | null;
  dnr_status: string | null;
  dnr_location: string | null;
  polst_status: string | null;
  palliative_care_status: string | null;
  hospice_status: string | null;
  advance_directive_notes: string | null;
  emergency_medical_treatment_authorization: boolean | null;
  self_admin_med_support: boolean | null;
  has_abi: boolean | null;
};

export const clientHealthKey = (orgId: string, clientId: string) =>
  ["client-health", orgId, clientId] as const;

export function useClientHealth(orgId: string, clientId: string) {
  return useQuery({
    queryKey: clientHealthKey(orgId, clientId),
    queryFn: async (): Promise<ClientHealthRow | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select(HEALTH_COLUMNS)
        .eq("id", clientId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ClientHealthRow | null) ?? null;
    },
  });
}

/** Saves a patch of medical columns; `after` runs once it is saved. */
export function useSaveHealth(orgId: string, clientId: string, after?: () => void | Promise<void>) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateClient);
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      await updateFn({ data: { organizationId: orgId, clientId, patch } });
      await after?.();
    },
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: clientHealthKey(orgId, clientId) });
      void qc.invalidateQueries({ queryKey: ["client-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Client medical: Edit. */
export function useCanEditMedical(): boolean {
  return useAccess().canCategory("client_medical", "edit");
}
