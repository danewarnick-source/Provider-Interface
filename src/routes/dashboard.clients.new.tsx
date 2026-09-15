import { createFileRoute } from "@tanstack/react-router";
import { AgencySetupCreateGate } from "@/components/onboarding/agency-setup-create-gate";
import { ClientsPage } from "./dashboard.clients";

export const Route = createFileRoute("/dashboard/clients/new")({
  head: () => ({ meta: [{ title: "Add client — Provider Interface" }] }),
  component: AddClientRoute,
});

function AddClientRoute() {
  return (
    <AgencySetupCreateGate>
      <ClientsPage startWithAddOpen />
    </AgencySetupCreateGate>
  );
}
