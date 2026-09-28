import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/(financial)/financial/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/financial/revenue" });
  },
});
