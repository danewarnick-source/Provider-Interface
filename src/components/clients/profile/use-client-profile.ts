// The client row behind the profile header and the Profile section, plus
// codes (active client_billing_codes), home name and current plan year.
// Contacts (guardian, support coordinator) come from useAllClientContacts, the
// same cached query the Contacts section saves into. Org-filtered; `null` when
// the client isn't in the org.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRouteUuid } from "@/lib/route-uuid";
import { loadActiveCodes } from "@/lib/clients/codes";
import { currentPlan, type ClientPlan } from "@/lib/clients/plans";
import { pcspState, type PcspState } from "@/lib/clients/pcsp-status";

const CLIENT_COLUMNS =
  "id, organization_id, first_name, last_name, date_of_birth, phone_number, medicaid_id, client_pid, insurance, admission_date, discharge_date, account_status, team_id, special_directions, about_me, physical_address, mailing_address, client_photo_url, client_photo_taken_on, is_own_guardian, hr_applicable, feature_config, disability_category";

export type ClientProfileRow = {
  id: string;
  organization_id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  medicaid_id: string | null;
  client_pid: string | null;
  insurance: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  account_status: string | null;
  team_id: string | null;
  special_directions: string | null;
  about_me: string | null;
  physical_address: string | null;
  mailing_address: string | null;
  client_photo_url: string | null;
  client_photo_taken_on: string | null;
  is_own_guardian: boolean | null;
  hr_applicable: boolean | null;
  feature_config: Record<string, boolean> | null;
  disability_category: string | null;
};

export type ClientProfileData = {
  client: ClientProfileRow;
  name: string;
  codes: string[];
  home: { id: string; name: string } | null;
  plan: Pick<ClientPlan, "start_date" | "end_date" | "label"> | null;
  /** The PCSP's state today (pcsp-status.ts): the header tile's wording. */
  pcsp: PcspState;
};

export const clientProfileKey = (orgId: string | undefined, clientId: string) =>
  ["client-profile", orgId, clientId] as const;

export function useClientProfile(orgId: string | undefined, clientId: string) {
  return useQuery({
    enabled: !!orgId && isRouteUuid(clientId),
    queryKey: clientProfileKey(orgId, clientId),
    queryFn: async (): Promise<ClientProfileData | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select(CLIENT_COLUMNS)
        .eq("id", clientId)
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const client = data as unknown as ClientProfileRow;
      const [codes, home, plans] = await Promise.all([
        loadActiveCodes(supabase, [clientId]),
        client.team_id
          ? supabase.from("teams").select("id, team_name").eq("id", client.team_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("client_plans")
          .select(
            "id, client_id, start_date, end_date, activated_on, meeting_date, status, label, source, document_id",
          )
          .eq("client_id", clientId),
      ]);
      const planRows = (plans.data ?? []) as ClientPlan[];
      const plan = currentPlan(planRows);
      const team = home.data as { id: string; team_name: string } | null;
      return {
        client,
        name: `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unnamed client",
        codes: codes.get(clientId) ?? [],
        home: team ? { id: team.id, name: team.team_name } : null,
        plan: plan
          ? { start_date: plan.start_date, end_date: plan.end_date, label: plan.label }
          : null,
        pcsp: pcspState(planRows),
      };
    },
  });
}
