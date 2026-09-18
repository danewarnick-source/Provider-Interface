import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retired standalone Authoritative Sources URL.
 * Knowledge is the product surface for agency document upload.
 */
export const Route = createFileRoute("/dashboard/authoritative-sources")({
  head: () => ({ meta: [{ title: "Knowledge — Provider Interface" }] }),
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/hub/knowledge",
      replace: true,
    });
  },
});
