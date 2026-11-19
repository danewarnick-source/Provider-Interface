// Scheduler › Needs you (B5). This file reads the kind filter from the URL and
// sends people without scheduling access back to the dashboard; the screen is
// components/scheduler/needs/needs-page.tsx.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { NeedsPage } from "@/components/scheduler/needs/needs-page";
import { isNeedKind, type NeedKind } from "@/lib/scheduler/needs-items";

export const Route = createFileRoute("/dashboard/scheduler_/needs")({
  head: () => ({ meta: [{ title: "Needs you — Provider Interface" }] }),
  validateSearch: (s: Record<string, unknown>): { kind?: NeedKind } => ({
    kind: isNeedKind(s.kind) ? s.kind : undefined,
  }),
  component: NeedsRoute,
});

function NeedsRoute() {
  const { kind } = Route.useSearch();
  const navigate = Route.useNavigate();
  const access = useAccess();
  if (access.isLoading)
    return <p className="p-8 text-sm text-[var(--hive-text-muted)]">Loading…</p>;
  if (!access.canCategory("scheduling", "view")) return <Navigate to="/dashboard" replace />;
  return <NeedsPage kind={kind} onKind={(k) => navigate({ search: { kind: k }, replace: true })} />;
}
