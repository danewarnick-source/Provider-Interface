// Offers open shifts to everyone qualified at once (Decision 6): each shift
// becomes open and visible to staff (published, no one on it) and everyone
// Find staff rates "Good fit" or "Check" (rank-staff.ts isQualified) gets a
// notification. Those notification rows are the record of who was asked
// (listShiftOffers in offer.functions.ts reads them back). Called by
// offerOpenShifts (the board) and sendChanges (publish.functions.ts). Runs as
// the calling user; callers check scheduling edit first.
import type { ShiftRowIn } from "./shift-guard.server.ts";
import { rankCandidates } from "./find-staff.server.ts";
import { isQualified } from "./rank-staff.ts";
import { fmtSpan } from "./board-model.ts";
import { notify, type SchedulerNotification } from "./notify.ts";
import { dayKey, parseLocalDate } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** The notification type an offer is sent as; listShiftOffers reads it back. */
export const OFFER_TYPE = "shift_published";

export type OfferShift = ShiftRowIn & { id: string; open_spots: number | null };

function when(s: ShiftRowIn): string {
  const day = parseLocalDate(dayKey(s.starts_at)).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} ${fmtSpan(s)}`;
}

/** Offers each open shift (no one on it, not cancelled). Returns how many people and shifts. */
export async function offerShifts(
  db: Db,
  orgId: string,
  shifts: readonly OfferShift[],
): Promise<{ people: number; shifts: number }> {
  const people = new Set<string>();
  const notes: SchedulerNotification[] = [];
  let offered = 0;
  for (const s of shifts) {
    if (s.staff_id || s.status === "cancelled") continue;
    const { data: rows, error } = await db
      .from("scheduled_shifts")
      .update({ status: "open", published: true, open_spots: s.open_spots ?? 1 })
      .eq("id", s.id)
      .is("staff_id", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) continue;
    offered += 1;
    const qualified = (await rankCandidates(db, orgId, s)).filter(isQualified);
    for (const c of qualified) {
      people.add(c.staffId);
      notes.push({
        organization_id: orgId,
        recipient_role: "staff",
        recipient_user_id: c.staffId,
        type: OFFER_TYPE,
        urgency: "normal",
        title: "Open shift you can pick up",
        body: `${(s.service_code ?? "").toUpperCase()} · ${when(s)}`,
        link_to: "/dashboard/schedule",
        related_id: s.id,
        related_type: "scheduled_shift",
      });
    }
  }
  await notify(db, notes);
  return { people: people.size, shifts: offered };
}
