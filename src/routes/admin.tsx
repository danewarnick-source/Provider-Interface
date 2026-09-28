import { createFileRoute } from "@tanstack/react-router";
import { AdminEntry } from "@/lib/auth/role-entry";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Provider Interface" }] }),
  component: AdminEntry,
});
