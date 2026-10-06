/**
 * YYYY-MM-DD in the browser's local time zone. `toISOString().slice(0, 10)`
 * is UTC, so in Utah it rolls to tomorrow after ~6 pm.
 */
export function localYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
