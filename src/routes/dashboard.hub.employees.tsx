import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { HubShell, type HubTab } from "@/components/admin-hubs/hub-shell";
import { usePermissions } from "@/hooks/use-permissions";
import { EmployeesPage } from "./dashboard.employees.index";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { HostsPage } from "@/components/hosts/hosts-page";

const search = z.object({
  tab: z
    .enum(["roster", "hosts", "hr-admin", "loans", "compliance"])
    .optional(),
});

function EmployeesHub() {
  const { can } = usePermissions();
  const tabs: HubTab[] = [
    { key: "roster", label: "Roster", render: () => <EmployeesPage /> },
  ];
  if (can("view_referrals") || can("manage_referrals") || can("view_staff_records")) {
    tabs.push({
      key: "hosts",
      label: "Hosts",
      render: () => <HostsPage />,
    });
  }
  return (
    <AgencySetupCreateGate>
      <HubShell title="Employees" basePath="/dashboard/hub/employees" tabs={tabs} />
    </AgencySetupCreateGate>
  );
}

export const Route = createFileRoute("/dashboard/hub/employees")({
  head: () => ({ meta: [{ title: "Employees — Provider Interface" }] }),
  validateSearch: (s) => search.parse(s),
  beforeLoad: ({ search: s }) => {
    if (s.tab === "loans" || s.tab === "hr-admin" || s.tab === "compliance") {
      throw redirect({
        to: "/dashboard/hub/employees",
        search: { tab: "roster" },
        replace: true,
      });
    }
  },
  component: EmployeesHub,
});
