// Settings › Homes: every home the agency runs, with Add home. ?archived=true
// shows archived homes too.
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { HomesList } from "@/components/homes/homes-list";

const search = z.object({ archived: z.boolean().optional().catch(undefined) });

export const Route = createFileRoute("/dashboard/settings/homes/")({
  head: () => ({ meta: [{ title: "Homes — Provider Interface" }] }),
  validateSearch: (s: Record<string, unknown>) => search.parse(s),
  component: HomesSettingsPage,
});

function HomesSettingsPage() {
  const { archived } = Route.useSearch();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/dashboard/settings"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <HomesList showArchived={!!archived} />
    </div>
  );
}
