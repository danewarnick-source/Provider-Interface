import { createFileRoute } from "@tanstack/react-router";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { EmployeesPage } from "./dashboard.employees.index";

export const Route = createFileRoute("/dashboard/employees/new")({
  head: () => ({ meta: [{ title: "Add employee — Provider Interface" }] }),
  component: AddEmployeeRoute,
});

function AddEmployeeRoute() {
  return (
    <AgencySetupCreateGate>
      <EmployeesPage />
    </AgencySetupCreateGate>
  );
}
