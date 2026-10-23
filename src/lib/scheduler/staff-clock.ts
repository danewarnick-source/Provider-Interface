/**
 * Staff Schedule clock-in gates. An open punch (client EVV or non-client
 * general) means this page must not offer a second clock-in. Shift cards
 * never show Open Time Clock — punch pad / Hub / Not-with-a-client is the clock.
 * Shift tap still opens the client Hub for viewing. pickShiftForClockIn picks
 * the scheduled shift a clock-in belongs to (workspace code prefill and the
 * clock-in rule check, so a punch links to the same shift the screen shows).
 */

export const SCHEDULE_NON_CLIENT_SECTION = "Not with a client";
export const SCHEDULE_NON_CLIENT_CLOCK_IN_TITLE = "Clock in";
export const SCHEDULE_NON_CLIENT_HELPER =
  "Working, but not at a client's home.";

export function scheduleHasOpenPunch(
  activeClientPunch: unknown,
  generalPunch: unknown,
): boolean {
  return !!activeClientPunch || !!generalPunch;
}

/** Staff schedule cards never deep-link to the punch pad. */
export function scheduleShiftOpensPunchPad(_opts?: {
  hasOpenPunch?: boolean;
  daily?: boolean;
}): boolean {
  return false;
}

/** Staff schedule cards never show an Open Time Clock CTA. */
export function scheduleShiftCta(_opts?: {
  hasOpenPunch?: boolean;
  daily?: boolean;
}): null {
  return null;
}

/** Group rows never show a Time Clock CTA. */
export function scheduleGroupRowCta(_opts?: {
  hasOpenPunch?: boolean;
  daily?: boolean;
}): null {
  return null;
}

/** Extra non-client card may start a punch only when nothing is already open. */
export function scheduleNonClientClockInAllowed(hasOpenPunch: boolean): boolean {
  return !hasOpenPunch;
}

/** Hide the DRAFT status pill on staff Schedule. Keep the shift itself. */
export function scheduleStaffHidesStatusBadge(
  status: string | null | undefined,
): boolean {
  return String(status ?? "").trim().toLowerCase() === "draft";
}

/** The shift a clock-in at `now` belongs to: under way, else next today, else today's first. */
export function pickShiftForClockIn<T extends { starts_at: string; ends_at: string }>(shifts: readonly T[], now: Date): T | null {
  const t = now.getTime();
  const sorted = [...shifts].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  return sorted.find((s) => +new Date(s.starts_at) <= t && +new Date(s.ends_at) >= t)
    ?? sorted.find((s) => +new Date(s.starts_at) >= t)
    ?? sorted[0]
    ?? null;
}
