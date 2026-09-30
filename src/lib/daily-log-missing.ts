// Host-home daily note rule — the Daily Logs page's "Missing entries" list,
// moved here unchanged so the team member Overview uses the same rule.
// Pure: no I/O.
//
// A client is on the daily-note model when its job_code includes HHS (host
// home) or RP5 (Exceptional Care Respite With Room and Board — same daily
// summary note). For each such client on the person's caseload, every past
// date with no daily_logs row from that person (rejected rows excluded by the
// caller's query) is a missing entry.

export type DailyLogProgram = "HHS" | "RP5";

/** HHS is host-home daily-note billing; RP5 uses the identical daily-summary-note model. */
export function dailyLogProgram(c: { job_code?: string[] | null }): DailyLogProgram | null {
  if (!Array.isArray(c.job_code)) return null;
  if (c.job_code.includes("HHS")) return "HHS";
  if (c.job_code.includes("RP5")) return "RP5";
  return null;
}

/** Every (client, date) with no submitted daily log. Unsorted; callers order/slice. */
export function missingDailyLogEntries<C extends { id: string }>(args: {
  /** Daily-note clients (dailyLogProgram(c) !== null) on the person's caseload. */
  clients: readonly C[];
  /** Past YYYY-MM-DD dates to check. */
  dates: readonly string[];
  /** The person's daily_logs rows, status <> 'rejected'. */
  submitted: readonly { client_id: string; log_date: string }[];
}): { client: C; date: string }[] {
  const have = new Set(args.submitted.map((r) => `${r.client_id}::${r.log_date}`));
  const out: { client: C; date: string }[] = [];
  for (const client of args.clients) {
    for (const date of args.dates) {
      if (!have.has(`${client.id}::${date}`)) out.push({ client, date });
    }
  }
  return out;
}
