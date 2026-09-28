import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/(courses)/courses/person")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/my-obligations" });
  },
  component: () => null,
});
