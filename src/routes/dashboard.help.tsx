import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { NectarPage } from "@/components/nectar/admin/nectar-page";
import { RequireLevel } from "@/components/rbac-guard";
import { FeatureGate } from "@/components/upgrade-gate";
import { clearLegacyNectarStorage } from "@/lib/nectar/browser-storage";
import { parseAdminNectarSearch } from "@/lib/nectar/nectar-nav";

export const Route = createFileRoute("/dashboard/help")({
  head: () => ({ meta: [{ title: "Nectar — Provider Interface" }] }),
  // ?tab=questions | settings, and ?q= from the header search (asked once).
  validateSearch: (s: Record<string, unknown>) => parseAdminNectarSearch(s),
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
      <NectarPage />
    </FeatureGate>
  );
}
