import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { KnowledgePage } from "@/components/pages/knowledge-page";
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
  component: () => (
    <FeatureGate featureKey="nectar">
      <KnowledgePage />
    </FeatureGate>
  ),
});
