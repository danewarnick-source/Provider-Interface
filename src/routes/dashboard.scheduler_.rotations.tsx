// Scheduler › Rotations (B6). This file reads the tab (?place=team:<id> or
// client:<id>) and the line to open (?line=, from a shift drawer's Open
// rotation) from the URL and sends people without scheduling access back to
// the dashboard; the screen is components/scheduler/rotations/rotations-page.tsx.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { RotationsPage } from "@/components/scheduler/rotations/rotations-page";

type Search = { place?: string; line?: string };
const text = (v: unknown) => (typeof v === "string" && v.length <= 80 ? v : undefined);

export const Route = createFileRoute("/dashboard/scheduler_/rotations")({
  head: () => ({ meta: [{ title: "Rotations — Provider Interface" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    place: text(s.place),
    line: text(s.line),
  }),
  component: RotationsRoute,
});

function RotationsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const access = useAccess();
  if (access.isLoading)
    return <p className="p-8 text-sm text-[var(--hive-text-muted)]">Loading…</p>;
  if (!access.canCategory("scheduling", "view")) return <Navigate to="/dashboard" replace />;
  return (
    <RotationsPage
      search={search}
      onSearch={(p) => navigate({ search: (prev) => ({ ...prev, ...p }), replace: true })}
    />
  );
}
