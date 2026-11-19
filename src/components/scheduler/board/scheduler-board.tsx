// The scheduler board (Office › Scheduler, /dashboard/scheduler): the week at
// a glance and fixed in place. Header and stat tiles, the Needs you banner
// (what the schedule can't settle on its own, B5), the toolbar, then the week
// grid (Homes & programs / Team members / Clients, with the 1056 panel on
// Clients) or the month. Chips open the shift drawer; Add shift and Find staff
// open drawers too. View, filter, range and week live in the URL (the route
// passes them); ?copy=1 (Rotations › Copy this week instead) opens Copy week.
import { useEffect, useMemo } from "react";
import { useCurrentOrg } from "@/hooks/use-org";
import { addDaysKey, dayKey, parseLocalDate, weekStartKey } from "@/lib/scheduler/time";
import { weekDays, type FilterKey, type Range, type View } from "@/lib/scheduler/board-model";
import { NectarFocusBanner } from "@/components/nectar/nectar-focus-banner";
import { NeedsBanner } from "@/components/scheduler/needs/needs-banner";
import { ReasonDialog } from "@/components/scheduler/settings/reason-dialog";
import { BoardProvider } from "./board-context";
import { BoardDrawers } from "./board-drawers";
import { BoardGrid } from "./board-grid";
import { BoardHeader } from "./board-header";
import { buildRows } from "./board-rows";
import { BoardToolbar, StatTiles } from "./board-toolbar";
import { AuthPanel } from "./auth-panel";
import { MonthView } from "./month-view";
import { useAuthOutlook } from "./use-board-data";
import { useBoardValue } from "./use-board-value";

export type BoardSearch = {
  view: View;
  show: FilterKey;
  range: Range;
  week?: string;
  copy?: boolean;
};

const EMPTY = {
  homes:
    "No homes or programs yet. Add one in Settings › Homes, or switch to Team members or Clients.",
  staff: "No team members yet.",
  clients: "No clients with an active code this week.",
};

function monthBounds(anchor: string) {
  const first = `${anchor.slice(0, 7)}-01`;
  const next = addDaysKey(`${anchor.slice(0, 7)}-28`, 4).slice(0, 7);
  return { first, nextFirst: `${next}-01` };
}

export function SchedulerBoard({
  search,
  onSearch,
}: {
  search: BoardSearch;
  onSearch: (p: Partial<BoardSearch>) => void;
}) {
  const orgId = useCurrentOrg().data?.organization_id;
  const anchor = search.week ?? dayKey(new Date());
  const week = weekStartKey(anchor);
  const month = search.range === "month";
  const range = useMemo(() => {
    const m = monthBounds(anchor);
    const from = month && m.first < week ? weekStartKey(m.first) : week;
    const to = month && m.nextFirst > addDaysKey(week, 7) ? m.nextFirst : addDaysKey(week, 7);
    return {
      from,
      to: addDaysKey(to, -1),
      startIso: parseLocalDate(from).toISOString(),
      endIso: parseLocalDate(to).toISOString(),
    };
  }, [anchor, week, month]);
  const { board, panel, error, actions } = useBoardValue(
    orgId,
    range,
    {
      startIso: parseLocalDate(week).toISOString(),
      endIso: parseLocalDate(addDaysKey(week, 7)).toISOString(),
    },
    weekDays(week),
  );
  const outlook = useAuthOutlook(orgId, week, search.view === "clients" && !month);
  const openCopy = !!search.copy && !!board;
  useEffect(() => {
    if (!openCopy || !board) return;
    if (board.canEdit && !month) board.open({ kind: "copy" });
    onSearch({ copy: undefined });
  }, [openCopy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error)
    return (
      <p className="p-8 text-sm text-[var(--hive-danger)]">
        The schedule didn't load: {error.message}. Reload the page to try again.
      </p>
    );
  if (!board)
    return <p className="p-8 text-sm text-[var(--hive-text-muted)]">Loading the schedule…</p>;

  const step = (dir: -1 | 0 | 1) => {
    if (dir === 0) return onSearch({ week: undefined });
    if (month)
      return onSearch({
        week: dir < 0 ? addDaysKey(monthBounds(anchor).first, -1) : monthBounds(anchor).nextFirst,
      });
    onSearch({ week: addDaysKey(week, dir * 7) });
  };
  return (
    <BoardProvider value={board}>
      <div className="mx-auto max-w-[1500px] space-y-3 px-3 py-4 sm:px-4">
        <NectarFocusBanner />
        <BoardHeader week={month ? monthBounds(anchor).first : week} month={month} onStep={step} />
        <StatTiles />
        <NeedsBanner orgId={board.orgId} />
        <section className="rounded-xl border border-[var(--hive-border)] bg-[var(--hive-surface)]">
          <BoardToolbar
            range={search.range}
            view={search.view}
            filter={search.show}
            onChange={onSearch}
          />
          {month ? (
            <MonthView
              month={anchor}
              filter={search.show}
              onPickWeek={(w) => onSearch({ week: w, range: "week" })}
            />
          ) : (
            <>
              {search.view === "clients" && (
                <AuthPanel rows={outlook.data} loading={outlook.isLoading} />
              )}
              <BoardGrid
                rows={buildRows(board, search.view, search.show, outlook.data ?? [])}
                view={search.view}
                empty={EMPTY[search.view]}
              />
              <p className="px-4 py-2 text-xs text-[var(--hive-text-muted)]">
                Dashed = draft · red = open · grey = cancelled · gold edge = changed, not sent.
                Click a shift to open it; drag to move, Alt-drag to copy, drag an edge to change the
                time. Nothing is deleted; cancelled shifts stay on record.
              </p>
            </>
          )}
        </section>
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
