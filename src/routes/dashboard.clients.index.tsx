import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/rbac-guard";
import { ClientsPage } from "@/features/clients/directory";

export const Route = createFileRoute("/dashboard/clients/")({
  head: () => ({ meta: [{ title: "Client Directory — Provider Interface" }] }),
  component: () => (
    <RequirePermission perm="view_clients">
      <ClientsPage />
    </RequirePermission>
  ),
});
