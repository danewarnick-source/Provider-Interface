// Who may call Nectar, and for which agency. Pure: no Supabase, no aliases,
// so node --test can import it. guard.server.ts wires the real reads.
//
// Every Nectar server function needs a signed-in, active member of an agency
// that has the `nectar` feature on. The agency it resolves is the one the
// per-agency Bedrock rate limit counts against (pass it to gatewayFetch).

export const NECTAR_FEATURE_KEY = "nectar";

export type NectarRefusal = "signed_out" | "not_member" | "feature_off";

export const NECTAR_REFUSAL_MESSAGE: Record<NectarRefusal, string> = {
  signed_out: "Sign in to use Nectar.",
  not_member: "Not a member of this organization",
  feature_off: "Nectar is turned off for your agency.",
};

export type NectarCallerCheck =
  | { ok: true; orgId: string }
  | { ok: false; reason: NectarRefusal; message: string };

export interface NectarCallerDeps {
  /** Agencies where this user has an active membership. */
  loadActiveOrgIds: (userId: string) => Promise<string[]>;
  /** The subset of `orgIds` that have the `nectar` feature on. */
  loadNectarOrgIds: (orgIds: string[]) => Promise<string[]>;
}

export function nectarRefusal(reason: NectarRefusal): NectarCallerCheck {
  return { ok: false, reason, message: NECTAR_REFUSAL_MESSAGE[reason] };
}

/**
 * The agency a Nectar call runs under. With `orgId`, the caller must be an
 * active member of that agency. Without it (the ai-coach functions, whose
 * inputs carry no agency), the first of the caller's agencies with Nectar on
 * is used, in a stable order.
 */
export async function checkNectarCaller(
  userId: string | null | undefined,
  deps: NectarCallerDeps,
  opts: { orgId?: string } = {},
): Promise<NectarCallerCheck> {
  if (!userId) return nectarRefusal("signed_out");
  const active = Array.from(new Set(await deps.loadActiveOrgIds(userId)));
  const candidates = opts.orgId ? active.filter((id) => id === opts.orgId) : active;
  if (candidates.length === 0) return nectarRefusal("not_member");
  const on = new Set(await deps.loadNectarOrgIds(candidates));
  const orgId = [...candidates].sort().find((id) => on.has(id));
  return orgId ? { ok: true, orgId } : nectarRefusal("feature_off");
}

/**
 * Agencies with `nectar` on: an agency's own organization_features row wins,
 * otherwise the feature_registry default. A missing default means off.
 */
export function nectarOrgIdsFrom(
  orgIds: readonly string[],
  registryDefault: boolean | null | undefined,
  overrides: ReadonlyArray<{ organization_id: string; enabled: boolean | null }>,
): string[] {
  const own = new Map(overrides.map((o) => [o.organization_id, o.enabled === true]));
  return orgIds.filter((id) => own.get(id) ?? (registryDefault === true));
}
