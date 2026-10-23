// Who is a new hire at which home (Decision 8): everyone on a home's team
// without an open sign-off in new_hire_signoffs. For each pair, the checklist
// the Settings › New hires tab shows before a sign-off is allowed: 30-day
// orientation and person-specific training for the home's clients, both from
// staffClientReadiness (team-members/readiness.ts), so the rules aren't
// restated. Called by settings.functions.ts. Runs as the caller (RLS applies).
import { staffClientReadiness } from "../../team-members/readiness.ts";
import type { BadgeEvidenceItem } from "../../team-members/badges.ts";
import type { EvidenceFileRow } from "../../evidence/types.ts";
import { dayKey } from "../time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type NewHireRow = {
  staffId: string;
  staffName: string;
  teamId: string;
  orientationOnFile: boolean;
  personTrainingOnFile: boolean;
  signoff: { id: string; signedBy: string; signedAt: string } | null;
};

async function all<T>(
  q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadNewHires(
  db: Db,
  orgId: string,
  homeIds: readonly string[],
  nameOf: (id: string) => string,
): Promise<NewHireRow[]> {
  if (!homeIds.length) return [];
  const clients = await all<{ id: string; team_id: string; has_abi: boolean | null }>(
    db
      .from("clients")
      .select("id, team_id, has_abi")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .in("team_id", homeIds),
  );
  if (!clients.length) return [];
  const clientIds = clients.map((c) => c.id);
  const [assignments, trainings, signoffs] = await Promise.all([
    all<{ staff_id: string; client_id: string }>(
      db
        .from("staff_assignments")
        .select("staff_id, client_id")
        .eq("organization_id", orgId)
        .in("client_id", clientIds),
    ),
    all<{ id: string; client_id: string }>(
      db
        .from("client_specific_trainings")
        .select("id, client_id")
        .eq("organization_id", orgId)
        .eq("status", "published")
        .in("client_id", clientIds),
    ),
    all<{ id: string; staff_id: string; team_id: string; signed_by: string; signed_at: string }>(
      db
        .from("new_hire_signoffs")
        .select("id, staff_id, team_id, signed_by, signed_at")
        .eq("organization_id", orgId)
        .is("ended_at", null),
    ),
  ]);
  const staffIds = [...new Set(assignments.map((a) => a.staff_id))];
  if (!staffIds.length) return [];
  const [items, completions] = await Promise.all([
    all<BadgeEvidenceItem & { subject_id: string }>(
      db
        .from("evidence_items")
        .select("*")
        .eq("organization_id", orgId)
        .eq("subject_type", "staff")
        .in("subject_id", staffIds),
    ),
    all<{ user_id: string; ref_id: string | null }>(
      db
        .from("training_completions")
        .select("user_id, ref_id")
        .eq("topic_kind", "person")
        .eq("is_current", true)
        .in("user_id", staffIds),
    ),
  ]);
  const files = items.length
    ? await all<EvidenceFileRow>(
        db
          .from("evidence_files")
          .select("*")
          .in(
            "item_id",
            items.map((i) => i.id),
          ),
      )
    : [];

  const homeOfClient = new Map(clients.map((c) => [c.id, c] as const));
  const today = dayKey(new Date());
  const out: NewHireRow[] = [];
  const seen = new Set<string>();
  for (const a of assignments) {
    const client = homeOfClient.get(a.client_id);
    if (!client) continue;
    const key = `${a.staff_id}|${client.team_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mine = items.filter((i) => i.subject_id === a.staff_id);
    const mineIds = new Set(mine.map((i) => i.id));
    const done = completions
      .filter((c) => c.user_id === a.staff_id && c.ref_id)
      .map((c) => c.ref_id!);
    const homeClients = clients.filter((c) => c.team_id === client.team_id);
    const missing = homeClients.flatMap((c) =>
      staffClientReadiness({
        today,
        hireDate: null,
        evidence: { items: mine, files: files.filter((f) => mineIds.has(f.item_id)) },
        client: { hasAbi: !!c.has_abi, behaviorSupport: false },
        personTraining: {
          requiredIds: trainings.filter((t) => t.client_id === c.id).map((t) => t.id),
          completedIds: done,
        },
      }).missing.map((m) => m.rule),
    );
    const s = signoffs.find((x) => x.staff_id === a.staff_id && x.team_id === client.team_id);
    out.push({
      staffId: a.staff_id,
      staffName: nameOf(a.staff_id),
      teamId: client.team_id,
      orientationOnFile: !missing.includes("orientation"),
      personTrainingOnFile: !missing.includes("person_training"),
      signoff: s ? { id: s.id, signedBy: nameOf(s.signed_by), signedAt: s.signed_at } : null,
    });
  }
  return out.sort(
    (x, y) => Number(!!x.signoff) - Number(!!y.signoff) || x.staffName.localeCompare(y.staffName),
  );
}
