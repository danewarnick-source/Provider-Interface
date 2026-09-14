import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/employees")({
  beforeLoad: ({ location }) => {
    const rest = location.pathname.replace(/^\/employees\/?/, "");
    if (!rest) {
      throw redirect({ to: "/dashboard/employees", replace: true });
    }
  },
  component: () => <Outlet />,
});
