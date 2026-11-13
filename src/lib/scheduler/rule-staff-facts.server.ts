// Team member facts for the rule engine: identity, age, membership, approved
// time off, Evidence (what qualificationsOnDate reads) and the homes they're
// signed off to work alone at (new_hire_signoffs). Called by
// rule-context.server.ts, and by open-shifts.functions.ts to decide who is
// offered a van shift. Runs as the calling user (RLS applies).
import { ageOn } from "../team-members/badges.ts";
import type { QualEvidence, StaffFacts } from "./rules-types.ts";
import { dayKey } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function rows<T>(
  q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function fullName(p: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return (p.full_name ?? "").trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
}

/** Each team member's Evidence items and files (what qualificationsOnDate reads). */
export async function loadStaffEvidence(
  db: Db,
  orgId: string,
  ids: readonly string[],
): Promise<Record<string, QualEvidence>> {
  if (!ids.length) return {};
  const items = await rows<QualEvidence["items"][number] & { subject_id: string }>(
    db
      .from("evidence_items")
      .select(
        "id, subject_id, requirement_key, evidence_type, expires_on, next_due_on, opted_out_at",
      )
      .eq("organization_id", orgId)
      .eq("subject_type", "staff")
      .in("subject_id", ids),
  );
  const itemIds = items.map((i) => i.id);
  const files = itemIds.length
    ? await rows<QualEvidence["files"][number]>(
        db
          .from("evidence_files")
          .select("id, item_id, review_status, uploaded_at, attested_at, storage_path, filename")
          .in("item_id", itemIds),
      )
    : [];
  return Object.fromEntries(
    ids.map((id) => {
      const mine = items.filter((i) => i.subject_id === id);
      const mineIds = new Set(mine.map((i) => i.id));
      return [id, { items: mine, files: files.filter((f) => mineIds.has(f.item_id)) }];
    }),
  );
}

export async function loadStaff(
  db: Db,
  orgId: string,
  ids: string[],
  firstDay: Record<string, string>,
) {
  if (!ids.length) return { staff: {}, evidence: {}, signedOffHomes: {} };
  const [profiles, members, timeOff, evidence, signoffs] = await Promise.all([
    rows<{
      id: string;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      date_of_birth: string | null;
      hire_date: string | null;
    }>(
      db
        .from("profiles")
        .select("id, full_name, first_name, last_name, date_of_birth, hire_date")
        .in("id", ids),
    ),
    rows<{ user_id: string; active: boolean | null }>(
      db
        .from("organization_members")
        .select("user_id, active")
        .eq("organization_id", orgId)
        .in("user_id", ids),
    ),
    rows<{ staff_id: string; start_date: string; end_date: string }>(
      db
        .from("time_off_requests")
        .select("staff_id, start_date, end_date")
        .eq("organization_id", orgId)
        .eq("status", "approved")
        .in("staff_id", ids),
    ),
    loadStaffEvidence(db, orgId, ids),
    rows<{ staff_id: string; team_id: string }>(
      db
        .from("new_hire_signoffs")
        .select("staff_id, team_id")
        .eq("organization_id", orgId)
        .is("ended_at", null)
        .in("staff_id", ids),
    ),
  ]);
  const signedOffHomes: Record<string, string[]> = {};
  for (const r of signoffs) (signedOffHomes[r.staff_id] ??= []).push(r.team_id);
  const staff: Record<string, StaffFacts> = {};
  for (const p of profiles) {
    staff[p.id] = {
      id: p.id,
      name: fullName(p) || "This team member",
      active: members.some((m) => m.user_id === p.id && m.active !== false),
      age: ageOn(p.date_of_birth, firstDay[p.id] ?? dayKey(new Date())),
      hireDate: p.hire_date,
      timeOff: timeOff
        .filter((t) => t.staff_id === p.id)
        .map((t) => [t.start_date, t.end_date] as const),
    };
  }
  return { staff, evidence, signedOffHomes };
}
