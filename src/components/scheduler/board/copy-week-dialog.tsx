// Copy week (B4, the demo's dlgCopy), opened from the board header. Copies
// this week to a week you pick (next week by default, up to 4 weeks ahead):
// Everything, one home or program, or community only. The preview
// (previewCopyWeek) shows how many land as drafts, which land open and why,
// and which are skipped because the target week already has them. Copy as
// drafts (copyWeek) creates them through the rule engine; the toast's Undo
// cancels every copy (kept on record).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyWeek, previewCopyWeek } from "@/lib/scheduler/copy-week.functions";
import { weekSpan, type Skip } from "@/lib/scheduler/copy-week";
import { filterOptions } from "@/lib/scheduler/board-model";
import { addDaysKey } from "@/lib/scheduler/time";
import { useBoard, type Board } from "./board-context";
import { shiftLabel } from "./shift-label";

const WHY: Record<Skip["why"], string> = {
  person: "they already have a shift then",
  client: "the client already has a shift then",
  duplicate: "it's already there",
  parent: "its main shift wasn't copied",
  blocked: "it can't be copied",
};

function Choice({ on, label, pick }: { on: boolean; label: string; pick: () => void }) {
  return (
    <Button
      variant={on ? "default" : "outline"}
      size="sm"
      className="min-h-11"
      aria-pressed={on}
      onClick={pick}
    >
      {label}
    </Button>
  );
}

function Lines({
  b,
  title,
  rows,
}: {
  b: Board;
  title: string;
  rows: { sourceId: string; text: string }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="text-sm">
      <div className="font-semibold">{title}</div>
      <ul className="list-disc pl-5">
        {rows.map((r) => (
          <li key={r.sourceId}>
            {shiftLabel(b, r.sourceId)}: {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CopyWeekDialog() {
  const b = useBoard();
  const qc = useQueryClient();
  const from = b.days[0]!;
  const [weeks, setWeeks] = useState(1);
  const [scope, setScope] = useState("all");
  const to = addDaysKey(from, 7 * weeks);
  const input = { organization_id: b.orgId, from_week: from, to_week: to, scope };
  const preview = useServerFn(previewCopyWeek);
  const copy = useServerFn(copyWeek);
  const q = useQuery({
    queryKey: ["scheduler-board", "copy-preview", input],
    queryFn: () => preview({ data: input }),
    staleTime: 0,
  });
  const p = q.data;
  const landing = p ? p.drafts + p.open.length : 0;
  const go = useMutation({
    mutationFn: () => copy({ data: input }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
      b.actions.copied(
        r.ids,
        `Copied ${r.ids.length} shift${r.ids.length === 1 ? "" : "s"} to ${weekSpan(to)} as drafts`,
      );
      b.close();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const scopes = filterOptions(b.data.teams).filter((o) => o.key !== "host");
  const disabledWhy = !p
    ? "Checking the copy…"
    : landing
      ? null
      : "Nothing to copy: every shift is already there or can't be copied.";

  return (
    <Dialog open onOpenChange={(o) => !o && !go.isPending && b.close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Copy to {weekSpan(to)}</DialogTitle>
          <DialogDescription>
            Copies {weekSpan(from)} as drafts on the same weekdays. Never overwrites a shift that's
            already there.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <div className="text-sm font-semibold">Copy to</div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((n) => (
              <Choice
                key={n}
                on={weeks === n}
                label={weekSpan(addDaysKey(from, 7 * n))}
                pick={() => setWeeks(n)}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold">What to copy</div>
          <div className="flex flex-wrap gap-2">
            {scopes.map((o) => (
              <Choice
                key={o.key}
                on={scope === o.key}
                label={o.key === "community" ? "Community only" : o.label}
                pick={() => setScope(o.key)}
              />
            ))}
          </div>
        </div>
        {q.isLoading && <p className="text-sm text-[var(--hive-text-muted)]">Checking the copy…</p>}
        {q.error && (
          <p className="text-sm text-[var(--hive-danger)]">
            The preview didn't load: {q.error.message}
          </p>
        )}
        {p && (
          <div className="space-y-3 rounded-md border border-[var(--hive-border)] p-3">
            <p className="text-sm font-semibold">
              {p.source} shift{p.source === 1 ? "" : "s"} → {p.drafts} draft
              {p.drafts === 1 ? "" : "s"}
              {p.open.length ? ` · ${p.open.length} open` : ""}
              {p.skipped.length ? ` · ${p.skipped.length} skipped` : ""}
            </p>
            <Lines
              b={b}
              title="Lands as an open shift (offered when you send)"
              rows={p.open.map((o) => ({ sourceId: o.sourceId, text: o.message }))}
            />
            <Lines
              b={b}
              title="Copies with a flag"
              rows={p.notes.map((o) => ({ sourceId: o.sourceId, text: o.message }))}
            />
            <Lines
              b={b}
              title="Skipped"
              rows={p.skipped.map((s) => ({ sourceId: s.sourceId, text: s.message ?? WHY[s.why] }))}
            />
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          {disabledWhy && (
            <span className="text-xs text-[var(--hive-text-muted)] sm:mr-auto">{disabledWhy}</span>
          )}
          <Button variant="outline" className="min-h-11" onClick={b.close}>
            Cancel
          </Button>
          <Button
            className="min-h-11"
            disabled={!!disabledWhy || go.isPending}
            title={disabledWhy ?? undefined}
            onClick={() => go.mutate()}
          >
            {go.isPending ? "Copying…" : "Copy as drafts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
