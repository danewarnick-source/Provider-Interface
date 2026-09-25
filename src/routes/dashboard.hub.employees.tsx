import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HubShell, type HubTab } from "@/components/admin-hubs/hub-shell";
import { RequirePermission } from "@/components/rbac-guard";
import { useAccess } from "@/hooks/use-access";
import { EmployeesPage } from "./dashboard.employees.index";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { HrAdminPage, EmployeeLoansPage } from "./dashboard.hr-admin";
import { HostsPage } from "@/components/hosts/hosts-page";

const search = z.object({
  tab: z
    .enum(["roster", "hosts", "hr-admin", "loans", "compliance"])
    .transform((v) => (v === "compliance" ? "hr-admin" : v))
    .optional(),
});

function EmployeesHub() {
  const { can } = useAccess();
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
  tabs.push({
    key: "hr-admin",
    label: "HR Admin",
    render: () => (
      <RequirePermission perm="view_staff_records">
        <HrAdminPage />
      </RequirePermission>
    ),
  });
  tabs.push({
    key: "loans",
    label: "Employee Loans",
    render: () => (
      <RequirePermission perm="view_staff_records">
        <EmployeeLoansPage />
      </RequirePermission>
    ),
  });
  return (
    <AgencySetupCreateGate>
      <HubShell title="Employees" basePath="/dashboard/hub/employees" tabs={tabs} />
    </AgencySetupCreateGate>
  );
}

export const Route = createFileRoute("/dashboard/hub/employees")({
  head: () => ({ meta: [{ title: "Employees — Provider Interface" }] }),
  validateSearch: (s) => search.parse(s),
  component: EmployeesHub,
});
