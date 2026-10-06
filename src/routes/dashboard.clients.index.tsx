import { createFileRoute, type SearchSchemaInput } from "@tanstack/react-router";
import { z } from "zod";
import { RequirePermission } from "@/components/rbac-guard";
import { ClientsPage } from "@/components/clients/list/clients-page";

/**
 * `?add=1` opens Add client (old /dashboard/clients/new links land here);
 * `?draft=<import subject id>` opens it prefilled from an imported draft;
 * `?view=discharged|referrals` picks the list view. Bad values are dropped.
 */
const clientsSearch = z.object({
  add: z.coerce.string().pipe(z.literal("1")).optional().catch(undefined),
  draft: z.string().uuid().optional().catch(undefined),
  view: z.enum(["active", "discharged", "referrals"]).optional().catch(undefined),
});

export const Route = createFileRoute("/dashboard/clients/")({
  head: () => ({ meta: [{ title: "Client Directory — Provider Interface" }] }),
  validateSearch: (s: { add?: 1 | "1"; draft?: string; view?: string } & SearchSchemaInput) =>
    clientsSearch.parse(s),
  component: ClientsIndexRoute,
});

function ClientsIndexRoute() {
  const { add, draft, view } = Route.useSearch();
  return (
    <RequirePermission perm="view_clients">
      <ClientsPage
        startWithAddOpen={add === "1"}
        startDraftId={draft ?? null}
        startView={view ?? "active"}
      />
    </RequirePermission>
  );
}
