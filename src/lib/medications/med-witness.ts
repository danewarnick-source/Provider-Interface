// Who can witness a controlled-medication count: a different, active member
// of the same agency, confirmed by their own sign-in. Pure.

export interface WitnessMembership {
  organization_id: string;
  active: boolean | null;
  deleted_at: string | null;
}

/** Why this person can't witness, or null when they can. */
export function witnessProblem(args: {
  witnessId: string;
  callerId: string;
  organizationId: string;
  membership: WitnessMembership | null;
}): string | null {
  if (args.witnessId === args.callerId) return "The witness has to be someone else.";
  const m = args.membership;
  if (!m || m.organization_id !== args.organizationId)
    return "The witness has to work for this agency.";
  if (m.active === false || m.deleted_at) return "The witness's account isn't active.";
  return null;
}

/** Minutes a witness sign-in stays usable (log_medication_dose checks the same). */
export const WITNESS_VALID_MINUTES = 15;
