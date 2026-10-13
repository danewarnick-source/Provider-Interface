import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { KnowledgePage } from "@/components/pages/knowledge-page";
import { RequireLevel } from "@/components/rbac-guard";
import { FeatureGate } from "@/components/upgrade-gate";

const search = z.object({
  // Retired Knowledge tabs (sources / docs / external) still land here.
  tab: z.string().optional(),
});

export const Route = createFileRoute("/dashboard/hub/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge — Provider Interface" },
      {
        name: "description",
        content:
          "Upload agency documents. Nectar ingests them into its knowledge base for Nectar search.",
      },
    ],
  }),
  validateSearch: (s) => search.parse(s),
  // Admins only; a team member opening the URL is sent to Ask Nectar.
  component: () => (
    <RequireLevel min="admin" redirectTo="/dashboard/ask-nectar">
      <FeatureGate featureKey="nectar">
        <KnowledgePage />
      </FeatureGate>
    </RequireLevel>
  ),
});
