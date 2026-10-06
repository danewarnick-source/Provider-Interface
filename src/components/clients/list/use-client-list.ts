import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { backfillOrgHomePinsFromAddresses } from "@/lib/clients/home-pin.functions";
import { updateClient } from "@/lib/clients/writes.functions";
import type { ClientListRow, RosterTab } from "./client-list-types";

const CLIENT_LIST_COLUMNS =
  "id, first_name, last_name, phone_number, physical_address, pcsp_goals, job_code, authorized_dspd_codes, medicaid_id, account_status, geofence_radius_feet, special_directions, date_of_birth, emergency_contact_name, emergency_contact_phone, is_own_guardian, guardian_name, guardian_phone, guardian_relationship, guardian_email, feature_config, profile_photo_url, intake_status";

const isArchived = (c: ClientListRow) => (c.account_status ?? "active") === "archived";

/** Client directory data: roster, archived count, pending imports and row actions. */
export function useClientList(organizationId: string | undefined, rosterTab: RosterTab, search: string) {
  const qc = useQueryClient();

  const { data: allClients = [], isLoading } = useQuery({
    enabled: !!organizationId,
    queryKey: ["clients", organizationId],
    queryFn: async (): Promise<ClientListRow[]> => {
      const { data, error } = await (supabase as any)
        .from("clients")
        .select(CLIENT_LIST_COLUMNS)
        .eq("organization_id", organizationId!)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        job_code: (c.authorized_dspd_codes?.length ? c.authorized_dspd_codes : c.job_code) ?? [],
      })) as ClientListRow[];
    },
  });

  const clients = useMemo(
    () => allClients.filter((c) => (rosterTab === "archived" ? isArchived(c) : !isArchived(c))),
    [allClients, rosterTab],
  );
  const archivedCount = useMemo(() => allClients.filter(isArchived).length, [allClients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.medicaid_id ?? "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  const updateClientFn = useServerFn(updateClient);
  const reactivate = useMutation({
    mutationFn: async (clientId: string) => {
      await updateClientFn({
        data: { organizationId: organizationId!, clientId, patch: { account_status: "active" } },
      });
      return clientId;
    },
    onSuccess: () => {
      toast.success("Client reactivated.");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Count of pending client subjects (not jobs) across the org — banner
  // language and link point to the Pending Clients workspace so admins
  // can finish or discard them instead of routing into one job's done page.
  const { data: pendingClientCount = 0 } = useQuery({
    enabled: !!organizationId,
    queryKey: ["clients-uncommitted-imports", organizationId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (supabase as any)
        .from("import_subjects")
        .select("id", { count: "exact", head: true })
        .eq("org_id", organizationId!)
        .eq("subject_type", "client")
        .is("committed_at", null)
        .is("discarded_at", null);
      if (error) return 0;
      return count ?? 0;
    },
  });

  const backfillPinsFn = useServerFn(backfillOrgHomePinsFromAddresses);
  const backfillPins = useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("No organization");
      return backfillPinsFn({ data: { organizationId, limit: 8 } });
    },
    onSuccess: (r) => {
      toast.success(
        `Home pin refresh: ${r.updated} updated, ${r.skipped} unchanged, ${r.scanned} scanned. Street-level geocode only — no invented pins.`,
      );
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { filtered, isLoading, archivedCount, pendingClientCount, reactivate, backfillPins };
}
