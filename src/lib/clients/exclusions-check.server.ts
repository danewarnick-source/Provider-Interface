// Server-side reads of the do-not-schedule list through
// active_client_staff_exclusions (SECURITY DEFINER, org members only), so a
// scheduler without Clients access is still refused and told why.

import { exclusionRefusal, findExclusion, type StaffExclusion } from "./exclusions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

/** Open exclusions in this org (optionally one client). */
export async function loadActiveExclusions(
  supabase: AnySupabase,
  organizationId: string,
  clientId?: string,
): Promise<StaffExclusion[]> {
  const { data, error } = await supabase.rpc("active_client_staff_exclusions", {
    _org: organizationId,
    ...(clientId ? { _client: clientId } : {}),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffExclusion[];
}

/** The open exclusion for this pair, or null. */
export async function exclusionFor(
  supabase: AnySupabase,
  organizationId: string,
  clientId: string,
  staffId: string,
): Promise<StaffExclusion | null> {
  return findExclusion(
    await loadActiveExclusions(supabase, organizationId, clientId),
    clientId,
    staffId,
  );
}

/** Throws the scheduler refusal when the team member is excluded. */
export async function assertStaffNotExcluded(
  supabase: AnySupabase,
  args: {
    organizationId: string;
    clientId: string;
    staffId: string;
    staffName: string;
    clientName: string;
  },
): Promise<void> {
  const hit = await exclusionFor(supabase, args.organizationId, args.clientId, args.staffId);
  if (hit) throw new Error(exclusionRefusal(args.staffName, args.clientName, hit.reason));
}
