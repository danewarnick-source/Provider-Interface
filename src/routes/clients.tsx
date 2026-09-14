import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/clients")({
  beforeLoad: ({ location }) => {
    const rest = location.pathname.replace(/^\/clients\/?/, "");
    if (!rest) {
      throw redirect({ to: "/dashboard/clients", replace: true });
    }
  },
  component: () => <Outlet />,
});
