// The group home page (B7, /dashboard/scheduler/homes/<home>, opened from a
// home's name on the board): whether the home is covered this week and
// staffed to its Worksheet, fixed in place. Coverage by the hour, No staff
// needed, Residents (absence days, away times), Worksheet staffing hours and
// 1:1 enhanced staffing. It loads the board for the week (use-board-value.ts),
// so the shift drawer, Add shift, Find staff and the gap dialog are the
// board's own. Set up this home opens Settings › Homes (staffing needs live
// there). The week is in the URL (?week=).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-org";
import { homeCode, weekDays } from "@/lib/scheduler/board-model";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { addDaysKey, dayKey, parseLocalDate, weekStartKey } from "@/lib/scheduler/time";
import { BoardProvider } from "@/components/scheduler/board/board-context";
import { BoardDrawers } from "@/components/scheduler/board/board-drawers";
import { CodeTag } from "@/components/scheduler/board/board-ui";
import { useBoardValue } from "@/components/scheduler/board/use-board-value";
import { ReasonDialog } from "@/components/scheduler/settings/reason-dialog";
import { useHomesAccess } from "@/components/homes/use-homes";
import { CoverageCard } from "./coverage-card";
import { NoStaffCard } from "./no-staff-card";
import { ResidentsCard } from "./residents-card";
import { OneToOneCard, WorksheetCard } from "./staffing-cards";
import { useHomeResidents } from "./use-home-residents";

export function HomeWeekPage({
  teamId,
  week: weekParam,
  onWeek,
}: {
  teamId: string;
  week: string | undefined;
  onWeek: (week: string | undefined) => void;
}) {
  const orgId = useCurrentOrg().data?.organization_id;
  const setup = useHomesAccess();
  const week = weekStartKey(weekParam ?? dayKey(new Date()));
  const days = useMemo(() => weekDays(week), [week]);
  const range = useMemo(
    () => ({
      from: week,
      to: addDaysKey(week, 6),
      startIso: parseLocalDate(week).toISOString(),
      endIso: parseLocalDate(addDaysKey(week, 7)).toISOString(),
    }),
    [week],
  );
  const { board, panel, error, actions } = useBoardValue(orgId, range, range, days);
  const residents = (board?.data.coverage.residents ?? [])
    .filter((r) => r.team_id === teamId)
    .map((r) => r.id);
  const facts = useHomeResidents(orgId ?? "", teamId, residents);
  const home = board?.teams.get(teamId);

  if (error || facts.error)
    return (
      <p className="p-8 text-sm text-[var(--hive-danger)]">
        The home page didn't load: {(error ?? facts.error)!.message}. Reload the page to try again.
      </p>
    );
  if (!board) return <p className="p-8 text-sm text-[var(--hive-text-muted)]">Loading the home…</p>;
  if (!home || homeCode(home.team_type) !== "RHS")
    return (
      <div className="space-y-3 p-8 text-sm">
        <p>
          {home
            ? `${home.team_name} isn't a group home, so it has no home page here.`
            : "That home wasn't found, or it's archived."}
        </p>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/dashboard/scheduler">‹ Back to the board</Link>
        </Button>
      </div>
    );
  const props = { teamId, residents, facts: facts.data, days };
  return (
    <BoardProvider value={board}>
      <div className="mx-auto max-w-[1200px] space-y-3 px-3 py-4 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">
              {home.team_name} <CodeTag code="RHS" />
            </h1>
            <p className="text-sm text-[var(--hive-text-muted)]">
              Week of {fmtDay(week)} · {residents.length} resident
              {residents.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => onWeek(addDaysKey(week, -7))}
            >
              ‹ Week before
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => onWeek(undefined)}>
              This week
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => onWeek(addDaysKey(week, 7))}
            >
              Week after ›
            </Button>
            {setup.canView && (
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/dashboard/settings/homes/$teamId" params={{ teamId }}>
                  Set up this home
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/dashboard/scheduler" search={{ week }}>
                ‹ Back to the board
              </Link>
            </Button>
          </div>
        </div>
        <CoverageCard teamId={teamId} days={days} />
        <NoStaffCard teamId={teamId} />
        <ResidentsCard residents={residents} facts={facts.data} days={days} />
        <WorksheetCard {...props} />
        <OneToOneCard {...props} />
      </div>
      <BoardDrawers panel={panel} />
      <ReasonDialog
        open={!!actions.ask}
        title="Add a reason to go ahead"
        body={actions.ask?.message ?? ""}
        action="Save with this reason"
        onCancel={actions.closeAsk}
        onConfirm={(r) => actions.ask?.retry(r) ?? Promise.resolve(false)}
      />
    </BoardProvider>
  );
}
