import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { HubShell, type HubTab } from "@/components/admin-hubs/hub-shell";
import { RequirePermission } from "@/components/rbac-guard";
import { useAccess } from "@/hooks/use-access";
import { ClientsPage } from "./dashboard.clients";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { PbaLedgerPage } from "./dashboard.pba-ledger";
import { ClientLoansPage } from "./dashboard.client-loans";
import { ReferralsPage } from "@/components/referrals/referrals-page";
import { HostsPage } from "@/components/hosts/hosts-page";

const search = z.object({
  tab: z.enum(["directory", "referrals", "placements", "hosts", "teams", "funds"]).optional(),
});

function ClientsHub() {
  const { can, isOwner } = useAccess();
  const tabs: HubTab[] = [
    {
      key: "directory",
      label: "Directory",
      render: () => (
        <RequirePermission perm="view_clients">
          <ClientsPage />
        </RequirePermission>
      ),
    },
  ];
  if (can("view_referrals") || can("manage_referrals")) {
    tabs.push({
      key: "referrals",
      label: "Referrals",
      render: () => (
        <RequirePermission perm="view_referrals">
          <ReferralsPage />
        </RequirePermission>
      ),
    });
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
  tabs.push(
    {
      key: "funds",
      label: "Funds",
      render: () => (
        <div className="space-y-10">
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              PBA Trust Ledger
            </h3>
            <RequirePermission perm="view_clients">
              <PbaLedgerPage />
            </RequirePermission>
          </section>
          {isOwner && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Client Loan Ledger
              </h3>
              <ClientLoansPage />
            </section>
          )}
        </div>
      ),
    },
  );
  return (
    <AgencySetupCreateGate>
      <HubShell title="Clients" basePath="/dashboard/hub/clients" tabs={tabs} />
    </AgencySetupCreateGate>
  );
}

export const Route = createFileRoute("/dashboard/hub/clients")({
  head: () => ({ meta: [{ title: "Clients — Provider Interface" }] }),
  validateSearch: (s) => search.parse(s),
  beforeLoad: ({ search: s }) => {
    if (s.tab === "teams") {
      throw redirect({ to: "/dashboard/homes", replace: true });
    }
    if (s.tab === "hosts") {
      throw redirect({
        to: "/dashboard/hub/clients",
        search: { tab: "placements" },
        replace: true,
      });
    }
  },
  component: ClientsHub,
});
