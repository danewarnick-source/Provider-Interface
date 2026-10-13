import { createFileRoute } from "@tanstack/react-router";
import { NectarDocsPage } from "@/components/pages/nectar-docs-page";
import { RequireLevel } from "@/components/rbac-guard";
import { FeatureGate } from "@/components/upgrade-gate";

export const Route = createFileRoute("/dashboard/nectar-docs")({
  head: () => ({
    meta: [
      { title: "Company Docs — Provider Interface" },
      {
        name: "description",
        content:
          "Client and staff document uploads — PCSPs, 1056 budgets, intake/referrals, assessments, certifications, training records. NECTAR parses every file on upload.",
      },
    ],
  }),
  // Admins only; a team member opening the URL is sent to Ask Nectar.
  component: () => (
    <RequireLevel min="admin" redirectTo="/dashboard/ask-nectar">
      <FeatureGate featureKey="nectar">
        <NectarDocsPage />
      </FeatureGate>
    </RequireLevel>
  ),
});
