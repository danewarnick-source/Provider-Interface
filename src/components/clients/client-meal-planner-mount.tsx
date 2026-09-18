// Meal planner mount wrapper.
//
// Activation-by-setting:
//  - RHS/HHS clients (by authorized DSPD codes) → meal support ON by
//    default, planner renders directly.
//  - DSI/SLH/SLN-only clients → gated by MealSupportGate (per-client
//    activation with reason: pcsp_goal | intake_need | manual).
//  - Mixed codes (e.g. DSI + HHS) → on because HHS is present.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientMealPlannerPanel } from "./client-meal-planner-panel";
import { MealSupportGate } from "./meal-support-activation";

export function ClientMealPlannerMount({
  clientId,
  readOnly,
}: {
  clientId: string;
  readOnly?: boolean;
}) {
  const codesQ = useQuery({
    enabled: !!clientId,
    queryKey: ["client-authorized-codes-for-meal", clientId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("client_billing_codes")
        .select("service_code, service_end_date")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => !r.service_end_date || r.service_end_date >= today)
        .map((r) => (r.service_code || "").toUpperCase());
    },
  });

  if (codesQ.isLoading) return null;

  const codes = codesQ.data ?? [];
  const defaultOn = codes.some((c) => c === "HHS" || c === "RHS");

  if (defaultOn) {
    return <ClientMealPlannerPanel clientId={clientId} readOnly={readOnly} />;
  }

  return (
    <MealSupportGate clientId={clientId}>
      <ClientMealPlannerPanel clientId={clientId} readOnly={readOnly} />
    </MealSupportGate>
  );
}
