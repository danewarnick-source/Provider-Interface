import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/(courses)/courses/core")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/my-obligations" });
  },
  component: () => null,
});
