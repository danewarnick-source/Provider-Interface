// Date-only values (YYYY-MM-DD) for clients: birthdays, plan dates, due dates.
// Parsing a bare YYYY-MM-DD with the Date constructor gives UTC midnight, which shows the previous
// day in Utah. These helpers parse them as LOCAL calendar dates instead.

const YMD = /^(\d{4})-(\d{2})-(\d{2})/;

/** Local-midnight Date for a YYYY-MM-DD (or ISO timestamp's date part); null when blank/invalid. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = YMD.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Formats a date-only value for display (default "Jan 5, 2026"); `fallback` when blank/invalid. */
export function formatDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
  fallback = "—",
): string {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString("en-US", options) : fallback;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole years of age on `on` (default today); null when the birth date is blank/invalid. */
export function ageOn(birthDate: string | null | undefined, on: Date = new Date()): number | null {
  const dob = parseLocalDate(birthDate);
  if (!dob) return null;
  let age = on.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    on.getMonth() < dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Calendar days from `from` (default today) to the date; negative when past; null when blank. */
export function daysUntil(value: string | null | undefined, from: Date = new Date()): number | null {
  const d = parseLocalDate(value);
  if (!d) return null;
  const ms = startOfDay(d).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}
