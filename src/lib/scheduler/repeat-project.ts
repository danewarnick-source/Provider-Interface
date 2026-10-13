// Projects shifts from a source window onto a target week, weekday for weekday.
// America/Denver, Sunday weeks, independent of the server's time zone.
import {
  addDaysKey, dayKey, daysBetween, shiftByDays, weekdayOf, weekStartKey,
} from "./time.ts";

export type ShiftRow = {
  id: string;
  staff_id: string | null;
  client_id: string;
  service_code: string | null;
  job_code: string | null;
  starts_at: string;
  ends_at: string;
  shift_type: string | null;
  is_awake_overnight: boolean | null;
  notes: string | null;
};

// Weekday-aligned mapping: each source shift lands on the matching weekday
// in the target week. Time-of-day, duration, staff, client, code preserved.
// `targetWeekStartIso` is the Sunday of the target week.
export function projectShifts(
  shifts: ShiftRow[],
  targetWeekStartIso: string,
): Array<ShiftRow & { target_starts_at: string; target_ends_at: string; target_day: string }> {
  const out: Array<ShiftRow & { target_starts_at: string; target_ends_at: string; target_day: string }> = [];
  // All day math is America/Denver with Sunday weeks, whatever the server's zone is.
  const targetWeekKey = weekStartKey(dayKey(targetWeekStartIso));
  // Track per-(client, weekday-hh:mm) so a source that has multiple Tuesdays
  // (i.e. month source) doesn't collapse onto a single target Tuesday slot.
  const usedKey = new Set<string>();
  // Sort sources by date so earliest occurrence wins the target slot.
  const ordered = [...shifts].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const s of ordered) {
    const srcKey = dayKey(s.starts_at);
    const weekday = weekdayOf(srcKey);
    const targetKey = addDaysKey(targetWeekKey, weekday);
    const targetStart = shiftByDays(s.starts_at, daysBetween(srcKey, targetKey));
    const durationMs = new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime();
    const targetEnd = new Date(new Date(targetStart).getTime() + durationMs).toISOString();
    const key = `${s.client_id}|${(s.service_code ?? s.job_code ?? "").toUpperCase()}|${weekday}|${new Date(targetStart).toISOString().slice(11, 16)}|${s.staff_id ?? ""}`;
    if (usedKey.has(key)) continue;
    usedKey.add(key);
    out.push({
      ...s,
      target_starts_at: targetStart,
      target_ends_at: targetEnd,
      target_day: targetKey,
    });
  }
  return out;
}
