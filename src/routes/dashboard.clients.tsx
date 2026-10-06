import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClientsError } from "@/components/clients/list/clients-error";

// Layout route — renders child routes (e.g. /dashboard/clients/$clientId).
// The directory page lives at /dashboard/clients/ in dashboard.clients.index.tsx.
export const Route = createFileRoute("/dashboard/clients")({
  component: () => <Outlet />,
  errorComponent: ClientsError,
});
