import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/clients")({
  beforeLoad: ({ location }) => {
    if (!location.pathname.replace(/^\/clients\/?/, "")) throw redirect({ to: "/dashboard/clients", replace: true });
  },
  component: () => <Outlet />,
});
