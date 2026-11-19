// The home page's week panels (B7) that aren't coverage: Worksheet staffing
// hours (the residents' RHS Worksheet weekly hours vs hours scheduled with
// staff vs still open, §1.33) and the 1:1 enhanced staffing chips (RHS
// shifts at the home naming a resident, each with its Form 930 state,
// §21.3(4)). Pure; components/scheduler/home/ draws them.
import { isCancelled, shiftDay, shiftHours, type BoardShift } from "./board-model.ts";
import { form930On, rhsCodeOf, type Form930Doc, type RhsCodeRow } from "./residential-facts.ts";

const round1 = (n: number) => Math.round(n * 10) / 10;

export type WorksheetHours = {
  /** Sum of the residents' Worksheet weekly hours; null when none has one. */
  worksheet: number | null;
  staffed: number;
  open: number;
  /** Hours short of the Worksheet with the staff scheduled now (0 when it's met). */
  short: number;
};

/** Shifts at the home this week (home shifts and 1:1s; segments sit inside their shift). */
const atHome = (shifts: readonly BoardShift[], teamId: string, days: readonly string[]) =>
  shifts.filter(
    (s) =>
      s.team_id === teamId && !s.parent_shift_id && !isCancelled(s) && days.includes(shiftDay(s)),
  );

export function worksheetHours(
  teamId: string,
  residents: readonly string[],
  codes: readonly RhsCodeRow[],
  shifts: readonly BoardShift[],
  days: readonly string[],
): WorksheetHours {
  const mine = atHome(shifts, teamId, days);
  const staffed = round1(mine.filter((s) => s.staff_id).reduce((n, s) => n + shiftHours(s), 0));
  const open = round1(
    mine.filter((s) => !s.staff_id).reduce((n, s) => n + shiftHours(s) * (s.open_spots ?? 1), 0),
  );
  const values = residents
    .map((r) => rhsCodeOf(codes, r, days[0] ?? "")?.worksheet_weekly_hours)
    .filter((v): v is number => v != null);
  const worksheet = values.length ? round1(values.reduce((a, b) => a + Number(b), 0)) : null;
  return {
    worksheet,
    staffed,
    open,
    short: worksheet == null ? 0 : Math.max(0, round1(worksheet - staffed)),
  };
}

export type OneToOneChip = {
  shift: BoardShift;
  day: string;
  clientId: string;
  /** The Form 930 covering that day, or null ("No Form 930"). */
  form930: Form930Doc | null;
};

/** RHS 1:1 shifts at the home this week, by start, with their Form 930. */
export function oneToOneChips(
  teamId: string,
  residents: readonly string[],
  docs: readonly Form930Doc[],
  shifts: readonly BoardShift[],
  days: readonly string[],
): OneToOneChip[] {
  return atHome(shifts, teamId, days)
    .filter(
      (s) =>
        !!s.client_id &&
        residents.includes(s.client_id) &&
        (s.service_code ?? "").toUpperCase() === "RHS",
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((s) => ({
      shift: s,
      day: shiftDay(s),
      clientId: s.client_id!,
      form930: form930On(docs, s.client_id!, shiftDay(s)),
    }));
}
