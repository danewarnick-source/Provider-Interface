// Do-not-schedule team members (client_staff_exclusions). A team member on a
// client's list must never be scheduled with, or assigned to, that client.
// The scheduler and the caseload writer refuse and say why. Lifted entries
// are ended (ended_at), never deleted. Pure — importable by node --test.

export type StaffExclusion = {
  client_id: string;
  staff_user_id: string;
  reason: string;
};

export const EXCLUSION_REASON_MAX = 500;

/** The open exclusion for this client + team member, if any. */
export function findExclusion(
  exclusions: readonly StaffExclusion[],
  clientId: string,
  staffId: string,
): StaffExclusion | null {
  return exclusions.find((e) => e.client_id === clientId && e.staff_user_id === staffId) ?? null;
}

/** Why the scheduler won't place this team member with this client. */
export function exclusionRefusal(staffName: string, clientName: string, reason: string): string {
  const why = reason.trim();
  return `You can't schedule this — ${staffName} is on ${clientName}'s do-not-schedule list${
    why ? `: ${why}` : ""
  }.`;
}

/** Why the team member can't be added to this client's team. */
export function exclusionAssignRefusal(reason: string): string {
  const why = reason.trim();
  return `This team member is on the client's do-not-schedule list${why ? `: ${why}` : ""}. End that first.`;
}

/**
 * Copied shifts keep their staff only when that staff isn't excluded for the
 * client; excluded ones become open shifts. Returns the rows and how many
 * lost their staff.
 */
export function openExcludedShifts<T extends { client_id: string; staff_id: string | null }>(
  rows: readonly T[],
  exclusions: readonly StaffExclusion[],
): { rows: T[]; opened: number } {
  let opened = 0;
  const out = rows.map((r) => {
    if (r.staff_id && findExclusion(exclusions, r.client_id, r.staff_id)) {
      opened++;
      return { ...r, staff_id: null };
    }
    return r;
  });
  return { rows: out, opened };
}

/** Validate a new exclusion's reason. */
export function cleanExclusionReason(
  reason: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = reason.trim();
  if (!value) return { ok: false, error: "Say why this team member shouldn't work with the client." };
  if (value.length > EXCLUSION_REASON_MAX) {
    return { ok: false, error: `Keep the reason under ${EXCLUSION_REASON_MAX} characters.` };
  }
  return { ok: true, value };
}
