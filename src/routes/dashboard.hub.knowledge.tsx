import { createFileRoute } from "@tanstack/react-router";
import { KnowledgePage } from "@/components/knowledge/knowledge-page";
import { RequireLevel } from "@/components/rbac-guard";
import { FeatureGate } from "@/components/upgrade-gate";
import { parseKnowledgeSearch } from "@/lib/nectar/library/knowledge-nav";

export const Route = createFileRoute("/dashboard/hub/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge base — Provider Interface" },
      {
        name: "description",
        content:
          "Your agency's policies, procedures and the state rules. Nectar answers only from what's published here.",
      },
    ],
  }),
  // ?tab, ?doc, ?rule and ?new (with ?slot / ?question); old tabs fall back to Library.
  validateSearch: (s: Record<string, unknown>) => parseKnowledgeSearch(s),
  // Admins only; a team member opening the URL is sent to Ask Nectar.
  component: () => (
    <RequireLevel min="admin" redirectTo="/dashboard/ask-nectar">
      <FeatureGate featureKey="nectar">
        <KnowledgePage />
      </FeatureGate>
    </RequireLevel>
  ),
});
