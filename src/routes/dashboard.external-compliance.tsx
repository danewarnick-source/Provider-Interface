import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retired External compliance URL.
 * That surface is gone; bookmarks land on Knowledge.
 */
export const Route = createFileRoute("/dashboard/external-compliance")({
  head: () => ({ meta: [{ title: "Knowledge — Provider Interface" }] }),
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/hub/knowledge",
      replace: true,
    });
  },
});
