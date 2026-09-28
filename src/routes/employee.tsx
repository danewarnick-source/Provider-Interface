import { createFileRoute } from "@tanstack/react-router";
import { EmployeeEntry } from "@/lib/auth/role-entry";

export const Route = createFileRoute("/employee")({
  head: () => ({ meta: [{ title: "Employee — Provider Interface" }] }),
  component: EmployeeEntry,
});
