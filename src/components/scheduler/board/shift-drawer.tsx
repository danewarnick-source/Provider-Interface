// The shift drawer: details, the rule engine's checks for this shift, who's
// been asked (offers and escalation steps, who-asked.tsx), and Edit day,
// place or time / Give it to someone else / Make it open / Cancel shift (or
// Restore). Nothing is deleted: cancelled shifts stay on record.
import { Button } from "@/components/ui/button";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import {
  fmtSpan,
  isCancelled,
  shiftDay,
  shiftHours,
  type BoardShift,
} from "@/lib/scheduler/board-model";
import { shiftFlags, staffName, useBoard } from "./board-context";
import { editDraft } from "./add-draft";
import { CodeTag, DrawerShell } from "./board-ui";
import { placeLabel } from "./shift-chip";
import { WhoAsked } from "./who-asked";

const LEVEL_CLASS = {
  block: "text-[var(--hive-danger)]",
  reason: "text-[var(--hive-gold)]",
  warn: "text-[var(--hive-text)]",
};

export function ShiftDrawer({ s }: { s: BoardShift }) {
  const b = useBoard();
  const flags = shiftFlags(b, s);
  const cancelled = isCancelled(s);
  const also = b.shifts
    .filter(
      (x) =>
        x.id !== s.id &&
        x.staff_id &&
        !isCancelled(x) &&
        placeLabel(b, x) === placeLabel(b, s) &&
        x.starts_at < s.ends_at &&
        s.starts_at < x.ends_at,
    )
    .map((x) => staffName(b, x.staff_id));
  const state = cancelled
    ? "Cancelled"
    : !s.published
      ? "Draft"
      : b.changed.has(s.id)
        ? "Changed · not sent"
        : "Published";
  const act = (p: Promise<boolean>) => void p.then((ok) => ok && b.close());
  return (
    <DrawerShell
      open
      onClose={b.close}
      kicker={`${(s.service_code ?? "").toUpperCase()} · ${state}`}
      title={placeLabel(b, s)}
      footer={
        <Button variant="outline" className="min-h-11" onClick={b.close}>
          Close
        </Button>
      }
    >
      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
        <dt className="text-[var(--hive-text-muted)]">Team member</dt>
        <dd>
          {s.staff_id ? (
            staffName(b, s.staff_id)
          ) : (
            <b className="text-[var(--hive-danger)]">Open</b>
          )}
        </dd>
        <dt className="text-[var(--hive-text-muted)]">When</dt>
        <dd>
          {fmtDay(shiftDay(s))} · {fmtSpan(s)} · {Math.round(shiftHours(s) * 100) / 100} h
        </dd>
        <dt className="text-[var(--hive-text-muted)]">Billing</dt>
        <dd>
          <CodeTag code={s.service_code} />
        </dd>
        <dt className="text-[var(--hive-text-muted)]">Also on</dt>
        <dd>{also.length ? also.join(", ") : "No one else"}</dd>
        {s.shift_type === "paired" && (
          <>
            <dt className="text-[var(--hive-text-muted)]">Paired</dt>
            <dd>Supervised shift for a new hire</dd>
          </>
        )}
        {s.override_reason && (
          <>
            <dt className="text-[var(--hive-text-muted)]">Reason on file</dt>
            <dd>{s.override_reason}</dd>
          </>
        )}
        {s.notes && (
          <>
            <dt className="text-[var(--hive-text-muted)]">Notes</dt>
            <dd>{s.notes}</dd>
          </>
        )}
      </dl>
      {s.staff_id && !cancelled && (
        <div>
          <h3 className="mb-1.5 text-sm font-bold">Checks for this shift</h3>
          <ul className="space-y-1 text-sm">
            {flags.length ? (
              flags.map((f, i) => (
                <li key={i} className={LEVEL_CLASS[f.level]}>
                  {f.level === "block" ? "✕" : "!"} {f.message}
                  {f.href && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={f.href} className="font-semibold underline">
                        Evidence ›
                      </a>
                    </>
                  )}
                </li>
              ))
            ) : (
              <li className="text-[var(--hive-ok)]">
                ✓ Authorization, training, cards, age and do-not-schedule checks passed
              </li>
            )}
          </ul>
        </div>
      )}
      {!cancelled && <WhoAsked b={b} s={s} />}
      {b.canEdit && (
        <div className="flex flex-wrap gap-2">
          {!cancelled && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => b.open({ kind: "add", draft: editDraft(s) })}
            >
              Edit day, place or time
            </Button>
          )}
          {!cancelled && (
            <Button
              variant={s.staff_id ? "outline" : "default"}
              className="min-h-11"
              onClick={() => b.open({ kind: "find", id: s.id })}
            >
              {s.staff_id ? "Give it to someone else" : "Find staff"}
            </Button>
          )}
          {!cancelled && s.staff_id && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => act(b.actions.makeOpen(s))}
            >
              Make it open
            </Button>
          )}
          {!cancelled && !s.staff_id && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => act(b.actions.offer([s.id]))}
            >
              {s.published ? "Offer again" : "Offer to qualified"}
            </Button>
          )}
          {cancelled ? (
            <Button className="min-h-11" onClick={() => act(b.actions.restore(s))}>
              Restore
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => act(b.actions.cancel(s))}
            >
              Cancel shift
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-[var(--hive-text-muted)]">
        Nothing is deleted: cancelled shifts stay on record and can be restored.
      </p>
    </DrawerShell>
  );
}
