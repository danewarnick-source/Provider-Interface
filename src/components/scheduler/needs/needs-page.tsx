// Scheduler › Needs you (/dashboard/scheduler/needs, B5): only what the
// schedule can't settle on its own, most urgent first, with the fix on each
// row. Filter chips by kind (kept in the URL by the route). The list is
// loadNeedsYou (use-needs.ts); the page also loads the board for the same days
// (needsWindow) so Find staff, a shift's drawer and the overtime list open
// here exactly as on the board.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-org";
import { NEED_TAG, needsWindow, type NeedKind } from "@/lib/scheduler/needs-items";
import { addDaysKey, dayKey, parseLocalDate } from "@/lib/scheduler/time";
import { BoardProvider } from "@/components/scheduler/board/board-context";
import { BoardDrawers } from "@/components/scheduler/board/board-drawers";
import { useBoardValue } from "@/components/scheduler/board/use-board-value";
import { ReasonDialog } from "@/components/scheduler/settings/reason-dialog";
import { NeedsRow } from "./needs-row";
import { useNeeds } from "./use-needs";
import { useNeedsActions } from "./use-needs-actions";

export function NeedsPage({
  kind,
  onKind,
}: {
  kind: NeedKind | undefined;
  onKind: (k: NeedKind | undefined) => void;
}) {
  const orgId = useCurrentOrg().data?.organization_id;
  const today = dayKey(new Date());
  const win = useMemo(() => {
    const w = needsWindow(today);
    const range = {
      from: w.from,
      to: addDaysKey(w.until, -1),
      startIso: parseLocalDate(w.from).toISOString(),
      endIso: parseLocalDate(w.until).toISOString(),
    };
    return { ...w, range };
  }, [today]);
  const needs = useNeeds(orgId);
  const { board, panel, error, actions } = useBoardValue(orgId, win.range, win.range, win.week);
  const act = useNeedsActions(orgId ?? "");

  const all = needs.data ?? [];
  const kinds = [...new Set(all.map((i) => i.kind))];
  const shown = kind ? all.filter((i) => i.kind === kind) : all;
  const fail = needs.error ?? error;
  const chip = (k: NeedKind | undefined, label: string) => (
    <button
      key={k ?? "all"}
      type="button"
      aria-pressed={kind === k}
      onClick={() => onKind(k)}
      className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${
        kind === k
          ? "border-[var(--hive-ink)] bg-[var(--hive-ink)] text-white"
          : "border-[var(--hive-border)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 px-3 py-4 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Needs you</h1>
          <p className="text-sm text-[var(--hive-text-muted)]">
            Only what the schedule can't settle on its own. Work the list top to bottom; the most
            urgent is first. Each row has the action on it.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/dashboard/scheduler">‹ Back to the board</Link>
        </Button>
      </div>
      {fail ? (
        <p className="text-sm text-[var(--hive-danger)]">
          Needs you didn't load: {fail.message}. Reload the page to try again.
        </p>
      ) : !board || needs.isLoading ? (
        <p className="text-sm text-[var(--hive-text-muted)]">Loading what needs you…</p>
      ) : (
        <BoardProvider value={board}>
          <section className="rounded-xl border border-[var(--hive-border)] bg-[var(--hive-surface)]">
            <div className="flex flex-wrap gap-2 border-b border-[var(--hive-border)] p-3">
              {chip(undefined, `All · ${all.length}`)}
              {kinds.map((k) =>
                chip(k, `${NEED_TAG[k]} · ${all.filter((i) => i.kind === k).length}`),
              )}
            </div>
            {shown.length ? (
              <ul>
                {shown.map((i) => (
                  <NeedsRow key={i.key} item={i} act={act} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-[var(--hive-text-muted)]">
                {all.length
                  ? "Nothing of this kind. Pick All to see the rest."
                  : "Nothing needs you. New call-outs, claims and requests will show up here."}
              </p>
            )}
          </section>
          <BoardDrawers panel={panel} />
          <ReasonDialog
            open={!!actions.ask}
            title="Add a reason to go ahead"
            body={actions.ask?.message ?? ""}
            action="Save with this reason"
            onCancel={actions.closeAsk}
            onConfirm={(r) => actions.ask?.retry(r) ?? Promise.resolve(false)}
          />
          <ReasonDialog
            key={act.ask?.title}
            open={!!act.ask}
            title={act.ask?.title ?? ""}
            body={act.ask?.body ?? ""}
            action={act.ask?.action ?? ""}
            onCancel={act.closeAsk}
            onConfirm={(r) => act.ask?.run(r) ?? Promise.resolve(false)}
          />
        </BoardProvider>
      )}
    </div>
  );
}
