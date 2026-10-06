import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { HubShell, type HubTab } from "@/components/admin-hubs/hub-shell";
import { RequirePermission } from "@/components/rbac-guard";
import { useAccess } from "@/hooks/use-access";
import { ClientsPage } from "@/components/clients/list/clients-page";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { HostsPage } from "@/components/hosts/hosts-page";

// Old tabs: hosts → placements; referrals → the client list's Referrals view;
// teams → Homes; funds → the PBA ledger (moves to the profile's Money later).
const search = z.object({
  tab: z.enum(["directory", "referrals", "placements", "hosts", "teams", "funds"]).optional(),
});

function ClientsHub() {
  const { can } = useAccess();
  const tabs: HubTab[] = [{ key: "directory", label: "Directory", render: () => <ClientsPage /> }];
  if (can("view_referrals") || can("manage_referrals")) {
    tabs.push({
      key: "placements",
      label: "Placements",
      render: () => (
        <RequirePermission perm="view_referrals">
          <HostsPage />
        </RequirePermission>
      ),
    });
  }
  return (
    <RequirePermission perm="view_clients">
      <AgencySetupCreateGate>
        <HubShell title="Clients" basePath="/dashboard/hub/clients" tabs={tabs} />
      </AgencySetupCreateGate>
    </RequirePermission>
  );
}

export const Route = createFileRoute("/dashboard/hub/clients")({
  head: () => ({ meta: [{ title: "Clients — Provider Interface" }] }),
  validateSearch: (s) => search.parse(s),
  beforeLoad: ({ search: s }) => {
    if (s.tab === "hosts")
      throw redirect({
        to: "/dashboard/hub/clients",
        search: { tab: "placements" },
        replace: true,
      });
    if (s.tab === "referrals")
      throw redirect({ to: "/dashboard/clients", search: { view: "referrals" }, replace: true });
    if (s.tab === "teams") throw redirect({ to: "/dashboard/homes", replace: true });
    if (s.tab === "funds") throw redirect({ to: "/dashboard/pba-ledger", replace: true });
  },
  component: ClientsHub,
});
