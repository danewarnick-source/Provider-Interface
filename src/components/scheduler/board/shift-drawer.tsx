// The shift drawer: details, the rule engine's checks for this shift, who's
// been asked (open shifts), and Edit day, place or time / Give it to someone
// else / Make it open / Cancel shift (or Restore). Nothing is deleted:
// cancelled shifts stay on record.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { listShiftOffers } from "@/lib/scheduler/offer.functions";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import {
  fmtSpan,
  isCancelled,
  shiftDay,
  shiftHours,
  type BoardShift,
} from "@/lib/scheduler/board-model";
import { shiftFlags, staffName, useBoard, type Board } from "./board-context";
import { editDraft } from "./add-draft";
import { CodeTag, DrawerShell } from "./board-ui";
import { placeLabel } from "./shift-chip";

const LEVEL_CLASS = {
  block: "text-[var(--hive-danger)]",
  reason: "text-[var(--hive-gold)]",
  warn: "text-[var(--hive-text)]",
};

function Asked({ b, s }: { b: Board; s: BoardShift }) {
  const run = useServerFn(listShiftOffers);
  const { data, isLoading } = useQuery({
    queryKey: ["scheduler-board", "offers", s.id],
    queryFn: () => run({ data: { organization_id: b.orgId, shift_id: s.id } }),
  });
  return (
    <div className="rounded-md border border-[var(--hive-border)] p-3">
      <h3 className="text-sm font-bold">Who's been asked</h3>
      {isLoading && <p className="text-sm text-[var(--hive-text-muted)]">Loading…</p>}
      {data && !data.length && (
        <p className="text-sm text-[var(--hive-text-muted)]">
          Not offered yet. Offer it to qualified people, or pick someone.
        </p>
      )}
      {data && data.length > 0 && (
        <ol className="mt-2 space-y-1 text-sm">
          {data.map((a, i) => (
            <li key={`${a.staffId}${i}`} className="flex justify-between gap-2">
              <span>
                {i + 1}. {staffName(b, a.staffId)}
              </span>
              <span className="text-[var(--hive-text-muted)]">
                {s.claim_requested_by === a.staffId
                  ? "Asked to take it"
                  : a.seenAt
                    ? "Seen"
                    : "No answer yet"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

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
  const state = cancelled ? "Cancelled" : s.published ? "Published" : "Draft";
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
      {!s.staff_id && !cancelled && <Asked b={b} s={s} />}
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
