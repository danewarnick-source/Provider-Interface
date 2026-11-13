// Find staff's candidates: the proposed shift evaluated once for each active
// team member with the rule engine (rules.ts), then ranked best fit first by
// rank-staff.ts. Adds no rules. Called by find-staff.functions.ts (Add shift ›
// Who, Find staff) and offer.functions.ts (who an open shift is offered to).
// Runs as the calling user, so RLS applies.
import { evaluateShift } from "./rules.ts";
import { loadRuleContext, toRuleShift, type ShiftRowIn } from "./rule-context.server.ts";
import { rankStaff, weekHours, type RankedCandidate } from "./rank-staff.ts";
import { rows } from "./rule-staff-facts.server.ts";
import { dayKey } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function activeMemberIds(db: Db, orgId: string): Promise<string[]> {
  const members = await rows<{ user_id: string | null }>(
    db
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("active", true)
      .is("deleted_at", null),
  );
  return [...new Set(members.map((m) => m.user_id).filter((id): id is string => !!id))];
}

/** Every active team member, ranked for this shift. The shift's own id (when editing) is left out of their hours. */
export async function rankCandidates(
  db: Db,
  orgId: string,
  shift: ShiftRowIn,
): Promise<RankedCandidate[]> {
  const ids = await activeMemberIds(db, orgId);
  if (!ids.length) return [];
  const id = shift.id ?? "proposed";
  const proposed = ids.map((staffId) =>
    toRuleShift({ ...shift, staff_id: staffId, status: "draft" }, id),
  );
  const ctx = await loadRuleContext(db, orgId, proposed);
  const day = dayKey(shift.starts_at);
  return rankStaff(
    proposed
      .filter((s) => ctx.staff[s.staffId!])
      .map((s) => ({
        staffId: s.staffId!,
        name: ctx.staff[s.staffId!]!.name,
        hoursThisWeek: weekHours(ctx.shifts, s.staffId!, day, id),
        findings: evaluateShift(s, ctx),
      })),
  );
}
