// Host-home daily note rule, shared by the Daily Logs page's "Missing entries"
// list and the team member Overview. Pure: no I/O.
//
// A client is on the daily-note model when its job_code includes HHS (host
// home) or RP5 (Exceptional Care Respite With Room and Board — same daily
// summary note). One note per client per day:
//   - A day counts only on or after an assignment's start date (the
//     staff_assignments row's created_at, as a Denver date).
//   - Any staff assigned to the client satisfies the day by writing that
//     day's note (the host or a respite worker alike).
//   - A missing day is the host home provider's: the assigned staff whose
//     Position is Host Home Provider and whose assignment had started. With no
//     such host, the gap belongs to the client only, never to every assigned
//     staff member.

export type DailyLogProgram = "HHS" | "RP5";

/** HHS is host-home daily-note billing; RP5 uses the identical daily-summary-note model. */
export function dailyLogProgram(c: { job_code?: string[] | null }): DailyLogProgram | null {
  if (!Array.isArray(c.job_code)) return null;
  if (c.job_code.includes("HHS")) return "HHS";
  if (c.job_code.includes("RP5")) return "RP5";
  return null;
}

/** A Position (staff_types key + label) that makes someone a Host Home Provider. */
export function isHostHomeProviderPosition(p: { key: string; label: string }): boolean {
  return p.key.trim().toLowerCase() === "hhp" || /host\s*home/i.test(p.label);
}

export type DailyNoteAssignment = {
  clientId: string;
  staffId: string;
  /** YYYY-MM-DD. Days before this don't count for this assignment. */
  startDate: string;
  /** The staff member's Position is Host Home Provider. */
  isHost: boolean;
};

export type DailyNoteRow = { client_id: string; log_date: string; user_id: string };

export type DailyNoteGap<C> = {
  client: C;
  date: string;
  /** Host home providers the gap is attributed to. Empty → the client's gap only. */
  hostStaffIds: string[];
};

/**
 * Every (client, day) with no note from any assigned staff, counted once per
 * client per day. Unsorted; callers order / slice.
 */
export function missingDailyNotes<C extends { id: string }>(args: {
  /** Daily-note clients (dailyLogProgram(c) !== null). */
  clients: readonly C[];
  /** Every staff assignment on those clients. */
  assignments: readonly DailyNoteAssignment[];
  /** Non-rejected daily_logs rows on those clients, any author. */
  notes: readonly DailyNoteRow[];
  /** Past YYYY-MM-DD dates to check. */
  dates: readonly string[];
}): DailyNoteGap<C>[] {
  const byClient = new Map<string, DailyNoteAssignment[]>();
  for (const a of args.assignments) {
    const list = byClient.get(a.clientId) ?? [];
    list.push(a);
    byClient.set(a.clientId, list);
  }
  const assigned = new Set(args.assignments.map((a) => `${a.clientId}::${a.staffId}`));
  const written = new Set(
    args.notes
      .filter((n) => assigned.has(`${n.client_id}::${n.user_id}`))
      .map((n) => `${n.client_id}::${n.log_date}`),
  );
  const out: DailyNoteGap<C>[] = [];
  for (const client of args.clients) {
    const mine = byClient.get(client.id) ?? [];
    for (const date of args.dates) {
      const active = mine.filter((a) => a.startDate <= date);
      if (!active.length) continue;
      if (written.has(`${client.id}::${date}`)) continue;
      const hosts = [...new Set(active.filter((a) => a.isHost).map((a) => a.staffId))];
      out.push({ client, date, hostStaffIds: hosts });
    }
  }
  return out;
}

/** The gaps one staff member owns (they're an active host on that client that day). */
export function dailyNoteGapsFor<C>(
  gaps: readonly DailyNoteGap<C>[],
  staffId: string,
): DailyNoteGap<C>[] {
  return gaps.filter((g) => g.hostStaffIds.includes(staffId));
}

/** (client, day) pairs a staff member is the active host for — the notes they owe. */
export function hostedDailyNoteDays<C extends { id: string }>(args: {
  clients: readonly C[];
  assignments: readonly DailyNoteAssignment[];
  dates: readonly string[];
  staffId: string;
}): { client: C; date: string }[] {
  const out: { client: C; date: string }[] = [];
  for (const client of args.clients) {
    const starts = args.assignments
      .filter((a) => a.clientId === client.id && a.staffId === args.staffId && a.isHost)
      .map((a) => a.startDate);
    if (!starts.length) continue;
    const start = starts.sort()[0]!;
    for (const date of args.dates) if (date >= start) out.push({ client, date });
  }
  return out;
}
