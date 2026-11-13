// Where Add shift starts: a new draft (from the header, a cell's + or a team
// member's +) or an existing shift opened with "Edit day, place or time". A
// locked team member gets their first place and the first shift type that
// doesn't overlap a shift they already have that day.
import {
  isCancelled,
  placeOptions,
  shiftDay,
  timesOn,
  wallClock,
  type BoardShift,
  type PlaceOption,
} from "@/lib/scheduler/board-model";
import type { AddDraft, Board } from "./board-context";
import type { BoardShiftType } from "@/lib/scheduler/board-data";

const hhmm = (t: string) => t.slice(0, 5);

/** Places for the Where step; a locked team member only sees their caseload's clients and homes. */
export function placesFor(b: Board, day: string, lockedStaff: string | null): PlaceOption[] {
  const forClients = lockedStaff
    ? new Set(b.data.assigns.filter((a) => a.staff_id === lockedStaff).map((a) => a.client_id))
    : undefined;
  return placeOptions(day, b.data.teams, b.data.clients, b.data.codes, forClients);
}

/** Shift types from Settings that apply at this kind of place. */
export function typesFor(b: Board, usedAt: PlaceOption["usedAt"] | undefined): BoardShiftType[] {
  return usedAt ? b.data.shiftTypes.filter((t) => t.used_at.includes(usedAt)) : [];
}

export function newDraft(
  b: Board,
  o: { day: string; placeKey?: string | null; staffId?: string | null; lock?: boolean },
): AddDraft {
  const staffId = o.staffId ?? null;
  const lock = !!o.lock && !!staffId;
  const places = placesFor(b, o.day, lock ? staffId : null);
  const place = places.find((p) => p.key === o.placeKey) ?? (lock ? places[0] : undefined);
  const mine = b.shifts.filter(
    (s) => s.staff_id === staffId && shiftDay(s) === o.day && !isCancelled(s),
  );
  const types = typesFor(b, place?.usedAt);
  const free =
    types.find((t) => {
      const w = timesOn(o.day, hhmm(t.start_time), hhmm(t.end_time));
      return !mine.some((s) => s.starts_at < w.ends_at && w.starts_at < s.ends_at);
    }) ?? types[0];
  return {
    day: o.day,
    placeKey: place?.key ?? null,
    staffId,
    lock,
    editId: null,
    start: free ? hhmm(free.start_time) : "09:00",
    end: free ? hhmm(free.end_time) : "13:00",
    shiftType: free?.key ?? null,
  };
}

export function editDraft(s: BoardShift): AddDraft {
  const code = (s.service_code ?? "").toUpperCase();
  return {
    day: shiftDay(s),
    placeKey: s.client_id ? `client:${s.client_id}:${code}` : `team:${s.team_id}`,
    staffId: s.staff_id,
    lock: false,
    editId: s.id,
    start: wallClock(s.starts_at),
    end: wallClock(s.ends_at),
    shiftType: s.shift_type,
  };
}
