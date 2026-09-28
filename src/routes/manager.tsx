import { createFileRoute } from "@tanstack/react-router";
import { ManagerEntry } from "@/lib/auth/role-entry";

export const Route = createFileRoute("/manager")({
  head: () => ({ meta: [{ title: "Manager — Provider Interface" }] }),
  component: ManagerEntry,
});
