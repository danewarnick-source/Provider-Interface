import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClientsError } from "@/features/clients/directory";

// Layout route — renders child routes (e.g. /dashboard/clients/$clientId).
// The directory page lives at /dashboard/clients/ in dashboard.clients.index.tsx.
export const Route = createFileRoute("/dashboard/clients")({
  component: () => <Outlet />,
  errorComponent: ClientsError,
});
