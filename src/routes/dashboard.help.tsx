import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { HelpChat } from "@/components/nectar/admin/help-chat";
import { RequireLevel } from "@/components/rbac-guard";
import { FeatureGate } from "@/components/upgrade-gate";
import { clearLegacyNectarStorage } from "@/lib/nectar/browser-storage";

export const Route = createFileRoute("/dashboard/help")({
  head: () => ({ meta: [{ title: "Need help? — NECTAR" }] }),
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q:
      typeof search.q === "string" && search.q.trim().length > 0
        ? search.q.slice(0, 1000)
        : undefined,
  }),
  component: HelpRoute,
});

/** Admins only; a team member opening the URL is sent to Ask Nectar. */
function HelpRoute() {
  // One-time cleanup of the question history older builds kept in the browser.
  useEffect(() => clearLegacyNectarStorage(), []);
  return (
    <RequireLevel min="admin" redirectTo="/dashboard/ask-nectar">
      <HelpPage />
    </RequireLevel>
  );
}

function HelpPage() {
  return (
    <FeatureGate featureKey="nectar">
      <HelpChat />
    </FeatureGate>
  );
}
