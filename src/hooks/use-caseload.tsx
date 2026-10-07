import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useCurrentOrg } from "./use-org";
import { usePortalView } from "./use-portal-view";
import { isAdminLevel } from "@/lib/access/levels";
import { loadActiveCodes } from "@/lib/clients/codes";

type ClientRow = Omit<CaseloadClient, "codes">;

const CASELOAD_COLUMNS =
  "id, first_name, last_name, home_latitude, home_longitude, medicaid_id, physical_address, geofence_radius_feet, special_directions, client_photo_url, feature_config, date_of_birth";

/** Attach each client's active codes (one client_active_codes call). */
async function withCodes(rows: ClientRow[]): Promise<CaseloadClient[]> {
  const codes = await loadActiveCodes(supabase, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, codes: codes.get(r.id) ?? [] }));
}

export type CaseloadClient = {
  id: string;
  first_name: string;
  last_name: string;
  home_latitude: number | null;
  home_longitude: number | null;
  /** Active service codes from client_billing_codes (the one source). */
  codes: string[];
  medicaid_id: string | null;
  physical_address: string | null;
  geofence_radius_feet?: number | null;
  special_directions: string | null;
  client_photo_url: string | null;
  feature_config: Record<string, boolean> | null;
  date_of_birth?: string | null;
};

/**
 * Returns the clients the current STAFF user is assigned to via staff_assignments.
 * Admins/managers see every client in the org.
 */
export function useCaseload() {
  const { user } = useAuth();
  const { data: org, isLoading: orgLoading } = useCurrentOrg();
  const { view } = usePortalView();
  const role = org?.access.level;
  const isManagerial = isAdminLevel(role);
  const shouldForceStaffCaseload = false;
  const canSeeWholeOrgCaseload = isManagerial && view === "admin" && !shouldForceStaffCaseload;

  return useQuery({
    enabled: !!user && !!org,
    queryKey: ["caseload", org?.organization_id, user?.id, canSeeWholeOrgCaseload, shouldForceStaffCaseload],
    queryFn: async (): Promise<CaseloadClient[]> => {
      if (orgLoading || !org || !user) return [];

      if (canSeeWholeOrgCaseload) {
        const { data, error } = await supabase
          .from("clients")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select(CASELOAD_COLUMNS as any)
          .is("deleted_at", null)
          .eq("organization_id", org!.organization_id)
          .order("last_name");
        if (error) throw error;
        return withCodes((data ?? []) as unknown as ClientRow[]);
      }

      // Staff: caseload resolver handles direct assignments + group-home override
      // (tenant-scoped via _org; RLS still applies to returned rows).
      const { data, error } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "clients_for_staff" as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { _org: org!.organization_id, _staff: user!.id } as any,
      );
      if (error) throw error;
      const rows = (data ?? []) as unknown as ClientRow[];
      // Sort by last name to match prior behavior
      return withCodes([...rows].sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "")));

    },
  });
}
