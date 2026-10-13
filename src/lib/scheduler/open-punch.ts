// An open EVV punch is "current" only while it plausibly belongs to a shift in
// progress. One from an earlier Denver day that has been open longer than a
// long shift is a forgotten punch: show it as something to fix, not as the
// shift the team member is working now.
import { dayKey } from "./time.ts";

/** Longest shift an overnight punch can reasonably span (e.g. 10pm to 6am). */
export const MAX_CURRENT_PUNCH_HOURS = 16;

export function isStaleOpenPunch(clockInIso: string, now: Date = new Date()): boolean {
  const earlierDay = dayKey(clockInIso) < dayKey(now);
  const ageHours = (now.getTime() - new Date(clockInIso).getTime()) / 3_600_000;
  return earlierDay && ageHours > MAX_CURRENT_PUNCH_HOURS;
}

/** "Mon, Oct 12" for the day the punch started, in America/Denver. */
export function openPunchDateLabel(clockInIso: string): string {
  return new Date(clockInIso).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
