// Clock-in runs the rule engine too (B1). Finds the scheduled shift a punch is
// made from (today, this staff member, client and code: the one under way,
// else the next one, else today's first), runs shift-guard on it, and returns
// its id so the punch is linked (evv_timesheets.scheduled_shift_id). With no
// scheduled shift, the rules run on a 15-minute shift starting now.
// Called by clock-in.functions.ts (the punch pad).
import { refusalLine, warningLines } from "./rules.ts";
import { checkShiftRows, SHIFT_COLUMNS, type ShiftRowIn } from "./shift-guard.server.ts";
import { pickShiftForClockIn } from "./staff-clock.ts";
import { dayKey, toLocalRange } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const QUARTER_HOUR = 15 * 60_000;

export type ClockInCheck = {
  scheduledShiftId: string | null;
  /** Set when clock-in is refused, or needs a reason the staff member hasn't typed. */
  refusal: string | null;
  /** Lines the staff member must give a reason for ("Require a reason" rules). */
  reasonLines: string[];
  warnings: string[];
};

export async function clockInCheck(
  db: Db,
  args: {
    orgId: string;
    staffId: string;
    clientId: string;
    code: string;
    now: Date;
    reason?: string | null;
  },
): Promise<ClockInCheck> {
  const code = args.code.trim().toUpperCase();
  const { startIso, endExclusiveIso } = toLocalRange(dayKey(args.now));
  const { data, error } = await db
    .from("scheduled_shifts")
    .select(
      SHIFT_COLUMNS,
    )
    .eq("organization_id", args.orgId)
    .eq("staff_id", args.staffId)
    .eq("client_id", args.clientId)
    .eq("service_code", code)
    .eq("published", true)
    .gte("starts_at", startIso)
    .lt("starts_at", endExclusiveIso);
  if (error) throw new Error(error.message);
  const live = ((data ?? []) as ShiftRowIn[]).filter(
    (s) => s.status !== "cancelled" && s.status !== "declined",
  );
  const picked = pickShiftForClockIn(live, args.now);
  const row: ShiftRowIn = picked ?? {
    staff_id: args.staffId,
    client_id: args.clientId,
    service_code: code,
    starts_at: args.now.toISOString(),
    ends_at: new Date(args.now.getTime() + QUARTER_HOUR).toISOString(),
  };
  const { verdict } = await checkShiftRows(db, args.orgId, [row], { reason: args.reason });
  return {
    scheduledShiftId: picked?.id ?? null,
    refusal: refusalLine(verdict),
    reasonLines: verdict.blocks.length ? [] : verdict.needReason.map((f) => f.message),
    warnings: warningLines(verdict),
  };
}
