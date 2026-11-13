import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useCurrentOrg } from "./use-org";
import { dayKey, toLocalRange } from "@/lib/scheduler/time";

export type TodayShiftRow = {
  id: string;
  client_id: string;
  client_name: string;
  service_code: string | null;
  starts_at: string;
  ends_at: string;
};

/**
 * Returns ALL of the current staff's scheduled shifts for today
 * (assigned and published), sorted by start time.
 */
export function useTodayShifts() {
  const { user } = useAuth();
  const { data: org } = useCurrentOrg();

  return useQuery({
    enabled: !!user?.id && !!org?.organization_id,
    queryKey: ["today-shifts-all", user?.id, org?.organization_id],
    queryFn: async (): Promise<TodayShiftRow[]> => {
      const now = new Date();
      const { startIso, endExclusiveIso } = toLocalRange(dayKey(now));

      const { data, error } = await supabase
        .from("scheduled_shifts")
        .select("id, client_id, service_code, starts_at, ends_at, status, published, clients:client_id(first_name, last_name)")
        .eq("staff_id", user!.id)
        .eq("organization_id", org!.organization_id)
        .gte("starts_at", startIso)
        .lt("starts_at", endExclusiveIso)
        .eq("published", true)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string; client_id: string; service_code: string | null;
        starts_at: string; ends_at: string;
        clients: { first_name: string; last_name: string } | null;
      }>;
      return rows.map((r) => ({
        id: r.id,
        client_id: r.client_id,
        client_name: r.clients
          ? `${r.clients.first_name} ${r.clients.last_name}`.trim()
          : "Client",
        service_code: r.service_code,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
      }));
    },
  });
}
