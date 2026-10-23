import { createFileRoute, redirect } from "@tanstack/react-router";

/** Permanent redirect: the directory opens Add client from `?add=1`. */
export const Route = createFileRoute("/dashboard/clients/new")({
  beforeLoad: ({ location: { hash } }) => {
    throw redirect({ to: "/dashboard/clients", search: { add: 1 }, hash, replace: true });
  },
});
