import { createFileRoute, type SearchSchemaInput } from "@tanstack/react-router";
import { z } from "zod";
import { RequirePermission } from "@/components/rbac-guard";
import { ClientsPage } from "@/components/clients/list/clients-page";

/**
 * `?add=1` opens the Add client dialog (old /dashboard/clients/new links land
 * here). The router JSON-parses `?add=1` to the number 1, so links pass the
 * number and the page reads the validated string "1"; a bad value is dropped.
 */
const clientsSearch = z.object({
  add: z.coerce.string().pipe(z.literal("1")).optional().catch(undefined),
});

export const Route = createFileRoute("/dashboard/clients/")({
  head: () => ({ meta: [{ title: "Client Directory — Provider Interface" }] }),
  validateSearch: (s: { add?: 1 | "1" } & SearchSchemaInput) => clientsSearch.parse(s),
  component: ClientsIndexRoute,
});

function ClientsIndexRoute() {
  const { add } = Route.useSearch();
  return (
    <RequirePermission perm="view_clients">
      <ClientsPage startWithAddOpen={add === "1"} />
    </RequirePermission>
  );
}
