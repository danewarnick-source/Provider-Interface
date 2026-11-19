// The shift drawer's "Who's been asked": the people an open shift was offered
// to (listShiftOffers, offer.functions.ts) and every escalation step, each
// with its time and answer (listEscalationEvents, escalation.functions.ts).
// Shown for an open shift, and for any shift someone was asked about.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEscalationEvents } from "@/lib/scheduler/escalation.functions";
import { listShiftOffers } from "@/lib/scheduler/offer.functions";
import type { BoardShift } from "@/lib/scheduler/board-model";
import { staffName, type Board } from "./board-context";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function WhoAsked({ b, s }: { b: Board; s: BoardShift }) {
  const open = !s.staff_id;
  const offersFn = useServerFn(listShiftOffers);
  const stepsFn = useServerFn(listEscalationEvents);
  const ref = { organization_id: b.orgId, shift_id: s.id };
  const offers = useQuery({
    enabled: open,
    queryKey: ["scheduler-board", "offers", s.id],
    queryFn: () => offersFn({ data: ref }),
  });
  const steps = useQuery({
    queryKey: ["scheduler-board", "escalation", s.id],
    queryFn: () => stepsFn({ data: ref }),
  });
  const offered = offers.data ?? [];
  const ladder = steps.data ?? [];
  const loading = (open && offers.isLoading) || steps.isLoading;
  if (!open && !ladder.length) return null;
  return (
    <div className="rounded-md border border-[var(--hive-border)] p-3">
      <h3 className="text-sm font-bold">Who's been asked</h3>
      {loading && <p className="text-sm text-[var(--hive-text-muted)]">Loading…</p>}
      {!loading && !offered.length && !ladder.length && (
        <p className="text-sm text-[var(--hive-text-muted)]">
          Not offered yet. Offer it to qualified people, or pick someone.
        </p>
      )}
      {offered.length > 0 && (
        <ol className="mt-2 space-y-1 text-sm">
          {offered.map((a, i) => (
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
      {ladder.length > 0 && (
        <>
          <h4 className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--hive-text-muted)]">
            Escalation
          </h4>
          <ol className="mt-1 space-y-1 text-sm">
            {ladder.map((l) => (
              <li key={l.key} className="flex justify-between gap-2">
                <span>
                  <span className="text-[var(--hive-text-muted)]">{clock(l.at)}</span> {l.text}
                </span>
                {l.answer && <span className="text-[var(--hive-text-muted)]">{l.answer}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
