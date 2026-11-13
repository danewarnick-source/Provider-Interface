// One home in Settings › Homes: Details, Residents, Staffing needs (not on
// host homes), Team, the scheduling settings that differ for this home, and
// the ⋯ menu with Archive home (off while anyone lives there). An archived
// home shows when and why, and Restore.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { PlaceSettingsCard } from "@/components/scheduler/settings/place-settings-card";
import { formatDate, localYmd } from "@/lib/clients/dates";
import { homeKindLabel } from "@/lib/homes/home-kind";
import { archiveBlockedReason } from "@/lib/homes/home-setup";
import { restoreHome } from "@/lib/homes/homes.functions";
import type { HomeDetail } from "@/lib/homes/homes-load.server";
import { ArchiveHomeDialog } from "./archive-home-dialog";
import { HomeDetailsCard } from "./home-details-card";
import { HomeResidentsCard, HomeTeamCard } from "./home-people-cards";
import { StaffingNeedsCard } from "./staffing-needs-card";
import { useHome, useHomesAccess, useRefreshHomes } from "./use-homes";

export function HomePage({ teamId }: { teamId: string }) {
  const access = useHomesAccess();
  const q = useHome(access.orgId, teamId, access.canView);
  const back = (
    <Link
      to="/dashboard/settings/homes"
      className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Homes
    </Link>
  );
  let body;
  if (access.isLoading || !access.orgId || q.isLoading) {
    body = <p className="text-sm text-muted-foreground">Loading home…</p>;
  } else if (!access.canView) {
    body = (
      <p className="text-sm text-muted-foreground">
        Only Owners and Admins with Scheduling access can see homes.
      </p>
    );
  } else if (q.isError) {
    body = (
      <p className="text-sm text-[var(--hive-danger-fg)]">
        This home didn't load: {(q.error as Error).message} Reload the page to try again.
      </p>
    );
  } else if (!q.data) {
    body = (
      <p className="text-sm text-muted-foreground">This home wasn't found. Go back to Homes.</p>
    );
  } else {
    body = <HomeSections orgId={access.orgId} detail={q.data} canEdit={access.canEdit} />;
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {back}
      {body}
    </div>
  );
}

function HomeSections({
  orgId,
  detail,
  canEdit,
}: {
  orgId: string;
  detail: HomeDetail;
  canEdit: boolean;
}) {
  const { home } = detail;
  const [archiving, setArchiving] = useState(false);
  const refresh = useRefreshHomes();
  const restoreFn = useServerFn(restoreHome);
  const restore = useMutation({
    mutationFn: () => restoreFn({ data: { organizationId: orgId, teamId: home.id } }),
    onSuccess: () => {
      toast.success("Home restored");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const blocked = archiveBlockedReason(detail.residents.length);
  const editable = canEdit && home.active;

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{home.name}</h1>
          <p className="text-sm text-muted-foreground">{homeKindLabel(home.kind)}</p>
        </div>
        <StatusTag tone={home.active ? "ok" : "neutral"}>
          {home.active ? "Active" : "Archived"}
        </StatusTag>
        {canEdit && !home.active ? (
          <Button onClick={() => restore.mutate()} disabled={restore.isPending}>
            {restore.isPending ? "Restoring…" : "Restore home"}
          </Button>
        ) : null}
        {editable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 max-md:h-11 max-md:w-11"
                aria-label={`More actions for ${home.name}`}
                title={`More actions for ${home.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!!blocked}
                onSelect={() => setArchiving(true)}
                className="flex-col items-start text-destructive focus:text-destructive"
                data-testid="archive-home"
              >
                Archive home
                {blocked ? <span className="text-xs text-muted-foreground">{blocked}</span> : null}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>
      {!home.active ? (
        <p className="rounded-xl border border-hive-border bg-[var(--hive-muted-surface)] p-3 text-sm">
          Archived {home.archivedAt ? formatDate(localYmd(new Date(home.archivedAt))) : ""}
          {home.archivedReason ? `: ${home.archivedReason}` : ""}. Restore it to change it.
        </p>
      ) : null}
      <HomeDetailsCard orgId={orgId} detail={detail} canEdit={editable} />
      <HomeResidentsCard detail={detail} canEdit={editable} />
      {home.kind !== "host_home" ? (
        <StaffingNeedsCard orgId={orgId} detail={detail} canEdit={editable} />
      ) : null}
      <HomeTeamCard detail={detail} />
      <PlaceSettingsCard teamId={home.id} name={home.name} />
      {archiving ? (
        <ArchiveHomeDialog
          orgId={orgId}
          teamId={home.id}
          name={home.name}
          onClose={() => setArchiving(false)}
        />
      ) : null}
    </>
  );
}
