// Settings › Homes list: each home with its kind, lead (the host, on a host
// home), how many live there, and Active / Archived. Show archived (kept in the
// URL) adds archived homes, greyed. + Add home asks for a name and kind, then
// opens the new home with Name focused. A row opens its home.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Home, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";
import { homeKindLabel, leadLabel } from "@/lib/homes/home-kind";
import { visibleHomes, type HomeListRow } from "@/lib/homes/home-setup";
import { AddHomeDialog } from "./add-home-dialog";
import { useHomeList, useHomesAccess } from "./use-homes";

export function HomesList({ showArchived }: { showArchived: boolean }) {
  const access = useHomesAccess();
  const q = useHomeList(access.orgId, access.canView);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  if (access.isLoading || !access.orgId) {
    return <p className="text-sm text-muted-foreground">Loading homes…</p>;
  }
  if (!access.canView) {
    return (
      <p className="text-sm text-muted-foreground">
        Only Owners and Admins with Scheduling access can see homes.
      </p>
    );
  }
  const all = q.data ?? [];
  const rows = visibleHomes(all, showArchived);
  const archivedCount = all.filter((h) => !h.active).length;

  return (
    <SectionCard
      icon={Home}
      title="Homes"
      description="Each home's kind, lead and staffing needs. Clients, the scheduler and Finances read them from here."
      testId="settings-homes"
      actions={
        access.canEdit ? (
          <Button onClick={() => setAdding(true)} data-testid="add-home">
            <Plus className="h-4 w-4" /> Add home
          </Button>
        ) : null
      }
    >
      <label className="mb-3 flex min-h-11 w-fit items-center gap-2 text-sm">
        <Switch
          checked={showArchived}
          onCheckedChange={(on) =>
            void navigate({
              to: "/dashboard/settings/homes",
              search: on ? { archived: true } : {},
              replace: true,
            })
          }
        />
        Show archived{archivedCount ? ` (${archivedCount})` : ""}
      </label>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading homes…</p>
      ) : q.isError ? (
        <p className="text-sm text-[var(--hive-danger-fg)]">
          Homes didn't load: {(q.error as Error).message} Reload the page to try again.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          action={
            access.canEdit ? (
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add home
              </Button>
            ) : null
          }
        >
          No homes yet. Add your first home to schedule and bill it.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-hive-border rounded-xl border border-hive-border">
          {rows.map((h) => (
            <HomeRow key={h.id} h={h} />
          ))}
        </ul>
      )}
      {adding ? <AddHomeDialog orgId={access.orgId} onClose={() => setAdding(false)} /> : null}
    </SectionCard>
  );
}

function HomeRow({ h }: { h: HomeListRow }) {
  const lead = leadLabel(h.kind);
  return (
    <li className={h.active ? "" : "opacity-60"}>
      <Link
        to="/dashboard/settings/homes/$teamId"
        params={{ teamId: h.id }}
        className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-[var(--hive-hover)]"
        data-testid="home-row"
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium text-hive-ink">{h.name}</div>
          <div className="text-xs text-muted-foreground">
            {homeKindLabel(h.kind)} · {lead}: {h.leadName ?? "not set"} · {h.residents}{" "}
            {h.residents === 1 ? "resident" : "residents"}
          </div>
        </div>
        <StatusTag tone={h.active ? "ok" : "neutral"}>{h.active ? "Active" : "Archived"}</StatusTag>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
