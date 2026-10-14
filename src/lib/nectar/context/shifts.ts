// The caller's own published shifts, for schedule questions (N5). No runtime
// aliases, so node --test can import it.
//
// FOR THE SCHEDULER: this is the only Nectar file that reads scheduled_shifts.
// It reads the caller's own rows (staff_id = the caller, in their agency),
// published, not cancelled, from the first of this month to 21 days ahead
// (Mountain Time), and the first and last names of those shifts' clients.
// Scheduler Part B re-points this one file.
//
// Times only: never hours worked or pay (Decision 7).

import { denverWallToIso, denverYmd, denverYmdFromInstant, parseYmd } from "../../denver-date.ts";
import type { NectarAskCaller, NectarDb, NectarFact } from "../engine/ask-types.ts";
import { questionWantsSchedule } from "../engine/intent.ts";

export const SHIFT_DAYS_AHEAD = 21;
const MAX_SHIFTS = 200;
const TZ = "America/Denver";

export interface ShiftRow {
  id: string;
  client_id: string;
  job_code: string | null;
  service_code: string | null;
  starts_at: string;
  ends_at: string;
}

function addDays(ymd: string, days: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  return new Date(Date.UTC(p.year, p.month - 1, p.day + days)).toISOString().slice(0, 10);
}

/** First of this month (Mountain Time) up to, not including, the day after today + 21. */
export function shiftWindow(now: Date): {
  fromIso: string;
  toIso: string;
  from: string;
  to: string;
} {
  const today = denverYmd(now);
  const from = `${today.slice(0, 8)}01`;
  const to = addDays(today, SHIFT_DAYS_AHEAD);
  return {
    fromIso: denverWallToIso(from, 0, 0),
    toIso: denverWallToIso(addDays(to, 1), 0, 0),
    from,
    to,
  };
}

function when(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(new Date(iso));
}

/** "Tue, Oct 14, 9:00 AM – 5:00 PM · Client A · SLN" */
export function shiftLine(s: ShiftRow, clientName: string): string {
  const start = when(s.starts_at, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const sameDay = denverYmdFromInstant(s.starts_at) === denverYmdFromInstant(s.ends_at);
  const end = when(
    s.ends_at,
    sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  );
  const code = s.service_code || s.job_code;
  return [`${start} – ${end}`, clientName, code].filter(Boolean).join(" · ");
}

export function scheduleFact(
  caller: Pick<NectarAskCaller, "userId">,
  shifts: readonly ShiftRow[],
  names: ReadonlyMap<string, string>,
  now: Date,
): NectarFact {
  const window = shiftWindow(now);
  const today = when(now.toISOString(), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const lines = shifts.map((s) => `- ${shiftLine(s, names.get(s.client_id) ?? "Client")}`);
  return {
    id: `schedule:${caller.userId}`,
    kind: "schedule",
    title: "Your published shifts",
    heading: `${window.from} to ${window.to}`,
    text: [
      `Today is ${today} (Mountain Time).`,
      lines.length
        ? `Published shifts from ${window.from} to ${window.to}:\n${lines.join("\n")}`
        : `No published shifts from ${window.from} to ${window.to}.`,
    ].join("\n"),
    clientId: null,
  };
}

/** The caller's shifts as one fact, only for a schedule question. */
export async function loadShiftFacts(
  db: NectarDb,
  caller: NectarAskCaller,
  question: string,
  now: Date = new Date(),
): Promise<NectarFact[]> {
  if (!questionWantsSchedule(question)) return [];
  const window = shiftWindow(now);
  const { data, error } = await db
    .from("scheduled_shifts")
    .select("id, client_id, job_code, service_code, starts_at, ends_at")
    .eq("organization_id", caller.orgId)
    .eq("staff_id", caller.userId)
    .eq("published", true)
    .neq("status", "cancelled")
    .gte("starts_at", window.fromIso)
    .lt("starts_at", window.toIso)
    .order("starts_at", { ascending: true })
    .limit(MAX_SHIFTS);
  if (error) throw new Error("Could not load your schedule.");
  const shifts = (data ?? []) as ShiftRow[];
  const ids = [...new Set(shifts.map((s) => s.client_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: clients } = await db
      .from("clients")
      .select("id, first_name, last_name")
      .eq("organization_id", caller.orgId)
      .in("id", ids);
    for (const c of clients ?? []) {
      names.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client");
    }
  }
  return [scheduleFact(caller, shifts, names, now)];
}
