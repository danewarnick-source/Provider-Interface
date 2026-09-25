import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { EmployeesPage } from "./dashboard.employees.index";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";

const search = z.object({
  tab: z.enum(["roster", "hosts", "hr-admin", "loans", "compliance"]).optional(),
});

function EmployeesHub() {
  return (
    <AgencySetupCreateGate>
      <EmployeesPage />
    </AgencySetupCreateGate>
  );
}

export const Route = createFileRoute("/dashboard/hub/employees")({
  head: () => ({ meta: [{ title: "Team Members — Provider Interface" }] }),
  validateSearch: (s) => search.parse(s),
  beforeLoad: ({ search: s }) => {
    if (s.tab === "hosts") {
      throw redirect({
        to: "/dashboard/hub/clients",
        search: { tab: "placements" },
        replace: true,
      });
    }
    if (s.tab) {
      throw redirect({
        to: "/dashboard/hub/employees",
        search: {},
        replace: true,
      });
    }
  },
  component: EmployeesHub,
});
