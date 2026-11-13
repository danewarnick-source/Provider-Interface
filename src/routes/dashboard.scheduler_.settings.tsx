// Scheduling settings: the Owner edits, agency-wide Admins see it read-only,
// everyone else goes back to the scheduler. The screen is
// components/scheduler/settings/settings-page.tsx.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAccess } from "@/hooks/use-access";
import {
  SchedulingSettingsPage,
  SETTINGS_TABS,
  type SettingsTabKey,
} from "@/components/scheduler/settings/settings-page";

const KEYS = SETTINGS_TABS.map(([k]) => k) as [SettingsTabKey, ...SettingsTabKey[]];

export const Route = createFileRoute("/dashboard/scheduler_/settings")({
  head: () => ({ meta: [{ title: "Scheduling settings — Provider Interface" }] }),
  validateSearch: z.object({ tab: z.enum(KEYS).optional() }),
  component: SchedulingSettingsRoute,
});

function SchedulingSettingsRoute() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const access = useAccess();
  if (access.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!access.isOwner && !access.isAgencyAdmin)
    return <Navigate to="/dashboard/scheduler" replace />;
  return (
    <SchedulingSettingsPage
      tab={tab ?? "rules"}
      onTab={(t) => navigate({ search: { tab: t }, replace: true })}
    />
  );
}
