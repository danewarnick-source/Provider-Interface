// A client's away times (B7, demo dlgAway): each line ("Mon–Fri · 9:00 AM –
// 3:00 PM · Job · Costco") with Remove, and + Add away time (days, time,
// where, details). Shared by the client profile (Profile › Away times) and
// the home page's Residents card; both save through away-times.functions.ts.
// Edits need Clients edit.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AWAY_LABELS,
  awayProblem,
  awayText,
  emptyAway,
  type AwayDraft,
  type AwayTime,
} from "@/lib/clients/away-times";
import { RecordDialog } from "@/components/clients/profile/health/record-dialog";
import { Choice, DayChoices } from "@/components/scheduler/home/no-staff-form";
import type { CoverageActions } from "@/components/scheduler/home/use-coverage-actions";

export function AwayTimesList({
  clientId,
  away,
  canEdit,
  act,
  compact,
}: {
  clientId: string;
  away: readonly AwayTime[];
  canEdit: boolean;
  act: CoverageActions;
  /** Home page: lines only, the add button sits on the resident's row. */
  compact?: boolean;
}) {
  const mine = away.filter((a) => a.client_id === clientId);
  return (
    <ul className="space-y-1">
      {mine.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className={compact ? "text-xs text-[var(--hive-text-muted)]" : ""}>
            Away {awayText(a)}
          </span>
          {canEdit && (
            <Button
              variant="link"
              className="h-auto min-h-11 p-0 text-xs"
              disabled={act.busy}
              onClick={() => void act.removeAway(clientId, a.id)}
            >
              Remove
            </Button>
          )}
        </li>
      ))}
      {!mine.length && !compact ? (
        <li className="text-sm text-[var(--hive-text-muted)]">
          No away times. Add day program, job or school hours so the home knows when they're out.
        </li>
      ) : null}
    </ul>
  );
}

export function AddAwayTime({ clientId, act }: { clientId: string; act: CoverageActions }) {
  const [draft, setDraft] = useState<AwayDraft | null>(null);
  const set = (p: Partial<AwayDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  return (
    <>
      <Button variant="outline" className="min-h-11" onClick={() => setDraft(emptyAway())}>
        + Add away time
      </Button>
      {draft ? (
        <RecordDialog
          title="Add away time"
          saveLabel="Save away time"
          open
          saving={act.busy}
          problem={awayProblem(draft)}
          onClose={() => setDraft(null)}
          onSave={() => void act.addAway(clientId, draft).then((ok) => ok && setDraft(null))}
        >
          <div className="space-y-1">
            <Label>Days</Label>
            <DayChoices days={draft.days} onChange={(days) => set({ days })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`away-a-${clientId}`}>Leaves at</Label>
              <Input
                id={`away-a-${clientId}`}
                type="time"
                value={draft.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`away-b-${clientId}`}>Back at</Label>
              <Input
                id={`away-b-${clientId}`}
                type="time"
                value={draft.end}
                onChange={(e) => set({ end: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Where</Label>
            <div className="flex flex-wrap gap-1.5">
              {AWAY_LABELS.map(([k, text]) => (
                <Choice key={k} on={draft.label === k} onClick={() => set({ label: k })}>
                  {text}
                </Choice>
              ))}
            </div>
          </div>
          <Input
            aria-label="Details"
            placeholder="Details, e.g. Costco, Mon–Fri"
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
          />
          <p className="text-xs text-[var(--hive-text-muted)]">
            Not billed. If every resident of the home is away at the same time, those hours need no
            staff.
          </p>
        </RecordDialog>
      ) : null}
    </>
  );
}
