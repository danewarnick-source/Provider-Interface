import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { HubShell, type HubTab } from "@/components/admin-hubs/hub-shell";
import { EmployeesPage } from "./dashboard.employees.index";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";

const search = z.object({
  tab: z
    .enum(["roster", "hosts", "hr-admin", "loans", "compliance"])
    .optional(),
});

function EmployeesHub() {
  const tabs: HubTab[] = [
    { key: "roster", label: "Roster", render: () => <EmployeesPage /> },
  ];
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
    if (s.tab === "hosts") {
      throw redirect({
        to: "/dashboard/hub/clients",
        search: { tab: "placements" },
        replace: true,
      });
    }
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
