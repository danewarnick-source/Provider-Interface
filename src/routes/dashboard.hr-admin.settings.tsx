import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy HR Settings (staff types and Nectar "propose types").
 * Bookmarks land on the employee roster.
 */
export const Route = createFileRoute("/dashboard/hr-admin/settings")({
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/hub/employees",
      search: {},
      replace: true,
    });
  },
});
