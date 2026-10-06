import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { redirectUnlessUuidParam } from "@/lib/route-uuid";
import { RequirePermission } from "@/components/rbac-guard";
import { ClientProfileHub } from "@/features/clients/profile";

const search = z.object({
  tab: z
    .enum([
      // canonical four + siblings
      "identity",
      "care-plan",
      "billing",
      "files",
      "activity",
      "operations",
      "compliance",
      // legacy deep-link values kept for backwards compat
      "profile",
      "care",
      "funds",
      "pcsp",
      "overview",
      "plan",
      "codes",
      "caseload",
      "shifts",
      "logs",
      "incidents",
      "summaries",
      "hhcert",
      "deadlines",
      "documents",
      "client-file",
    ])
    .optional(),
});

export const Route = createFileRoute("/dashboard/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client Profile — Provider Interface" }] }),
  validateSearch: search,
  beforeLoad: ({ params }) => {
    redirectUnlessUuidParam(params.clientId, {
      createTo: "/dashboard/clients/new",
      fallbackTo: "/dashboard/clients",
    });
  },
  component: () => (
    <RequirePermission perm="view_clients">
      <ClientProfileHub />
    </RequirePermission>
  ),
});
