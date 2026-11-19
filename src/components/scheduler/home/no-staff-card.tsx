// "No staff needed" on the home page (B7; the demo's Coverage templates):
// the home's weekly and one-time blocks, each with its reason, + New block
// and Remove (with Undo). While a block is in, those hours aren't gaps
// anywhere. Changes need Scheduling edit.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import {
  noStaffBlocks,
  noStaffProblem,
  noStaffWhen,
  type NoStaffDraft,
} from "@/lib/homes/no-staff";
import { dayKey } from "@/lib/scheduler/time";
import { useBoard } from "@/components/scheduler/board/board-context";
import { DrawerShell } from "@/components/scheduler/board/board-ui";
import { HomePanel } from "./home-panel";
import { NoStaffForm } from "./no-staff-form";
import { useCoverageActions } from "./use-coverage-actions";

const blank = (): NoStaffDraft => ({
  why: "",
  explanation: "",
  start: "09:00",
  end: "15:00",
  often: "weekly",
  date: dayKey(new Date()),
  days: [1, 2, 3, 4, 5],
});

export function NoStaffCard({ teamId }: { teamId: string }) {
  const b = useBoard();
  const act = useCoverageActions(b.orgId);
  const [draft, setDraft] = useState<NoStaffDraft | null>(null);
  const today = dayKey(new Date());
  const blocks = noStaffBlocks(
    b.data.coverage.needs
      .filter((n) => n.team_id === teamId)
      .map((n) => ({ ...n, awake_required: false })),
  ).filter((x) => !x.date || x.date >= today);
  const problem = draft ? noStaffProblem(draft) : null;
  const save = async () => {
    if (draft && (await act.saveNoStaff(teamId, draft, "Saved. Those hours need no staff.")))
      setDraft(null);
  };
  return (
    <HomePanel
      title="No staff needed"
      sub="Times no one needs to be at the home, with the reason. Weekly blocks repeat every week until you remove them."
      action={
        b.canEdit ? (
          <Button className="min-h-11" onClick={() => setDraft(blank())}>
            + New block
          </Button>
        ) : undefined
      }
    >
      {blocks.length ? (
        <ul className="divide-y divide-[var(--hive-border)]">
          {blocks.map((x) => (
            <li key={x.ids.join()} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1 text-sm">
                <b>{noStaffWhen(x, x.date ? `One time · ${fmtDay(x.date)}` : undefined)}</b>
                <div className="text-xs text-[var(--hive-text-muted)]">{x.reason}</div>
              </div>
              {b.canEdit && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={act.busy}
                  onClick={() => void act.removeNoStaff(teamId, x)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--hive-text-muted)]">
          No blocks yet. Add one here, or from any red stretch.
        </p>
      )}
      {draft && (
        <DrawerShell
          open
          onClose={() => setDraft(null)}
          kicker={b.teams.get(teamId)?.team_name ?? "Home"}
          title="No staff needed"
          dirty={!!draft.explanation.trim()}
          unsaved="this block"
          footer={
            <>
              <Button variant="outline" className="min-h-11" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button
                className="min-h-11"
                disabled={!!problem || act.busy}
                title={problem ?? undefined}
                onClick={() => void save()}
              >
                Save block
              </Button>
            </>
          }
        >
          <NoStaffForm draft={draft} onChange={setDraft} idPrefix="block" />
          {problem && draft.explanation ? (
            <p className="text-xs text-[var(--hive-danger)]">{problem}</p>
          ) : null}
        </DrawerShell>
      )}
    </HomePanel>
  );
}
