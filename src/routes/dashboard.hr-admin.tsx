import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy HR Admin page. Staff files live on Employees; evidence packs and
 * hire questions replaced staff-type requirement mapping.
 */
export const Route = createFileRoute("/dashboard/hr-admin")({
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/hub/employees",
      search: {},
      replace: true,
    });
  },
});
