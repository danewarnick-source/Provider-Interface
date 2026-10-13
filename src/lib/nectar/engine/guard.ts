// Who may call Nectar, and for which agency. Pure: no Supabase, no aliases,
// so node --test can import it. guard.server.ts wires the real reads.
//
// Every Nectar server function needs a signed-in, active member of an agency
// that has the `nectar` feature on. An AI call also needs the agency's AI
// settings (organizations.nectar_settings, N3) to have Nectar on and the
// matching feature on. The agency it resolves is the one the per-agency
// Bedrock rate limit counts against (pass it to gatewayFetch).

export const NECTAR_FEATURE_KEY = "nectar";

/** The per-feature AI settings an owner can turn off (Decision 10). */
export const NECTAR_AI_FEATURES = ["ask", "note_help", "pcsp_reading", "summary_drafts"] as const;
export type NectarAiFeature = (typeof NECTAR_AI_FEATURES)[number];

export type NectarSettings = { enabled: boolean } & Record<NectarAiFeature, boolean>;

export const DEFAULT_NECTAR_SETTINGS: NectarSettings = {
  enabled: true,
  ask: true,
  note_help: true,
  pcsp_reading: true,
  summary_drafts: true,
};

export type NectarRefusal = "signed_out" | "not_member" | "feature_off" | "setting_off";

export const NECTAR_REFUSAL_MESSAGE: Record<NectarRefusal, string> = {
  signed_out: "Sign in to use Nectar.",
  not_member: "Not a member of this organization",
  feature_off: "Nectar is turned off for your agency.",
  setting_off: "Nectar is turned off for your agency.",
};

export const NECTAR_SETTING_OFF_MESSAGE: Record<NectarAiFeature, string> = {
  ask: "Ask is turned off for your agency.",
  note_help: "Shift note help is turned off for your agency.",
  pcsp_reading: "PCSP reading is turned off for your agency.",
  summary_drafts: "Summary drafts are turned off for your agency.",
};

export type NectarCallerCheck =
  { ok: true; orgId: string } | { ok: false; reason: NectarRefusal; message: string };

export interface NectarCallerDeps {
  /** Agencies where this user has an active membership. */
  loadActiveOrgIds: (userId: string) => Promise<string[]>;
  /** The subset of `orgIds` that have the `nectar` feature on. */
  loadNectarOrgIds: (orgIds: string[]) => Promise<string[]>;
  /** The agency's raw organizations.nectar_settings value. */
  loadNectarSettings: (orgId: string) => Promise<unknown>;
}

export interface NectarCallerOptions {
  orgId?: string;
  /** The AI feature this call uses, or null for a Nectar call that makes no model call. */
  feature?: NectarAiFeature | null;
}

export function nectarRefusal(
  reason: NectarRefusal,
  message = NECTAR_REFUSAL_MESSAGE[reason],
): NectarCallerCheck {
  return { ok: false, reason, message };
}

/** The agency's AI settings. Anything missing or not a boolean counts as on (the default). */
export function nectarSettingsFrom(raw: unknown): NectarSettings {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_NECTAR_SETTINGS };
  for (const key of ["enabled", ...NECTAR_AI_FEATURES] as const) {
    if (typeof obj[key] === "boolean") out[key] = obj[key] as boolean;
  }
  return out;
}

/** Null when the feature may run; otherwise the message to show. */
export function aiSettingRefusal(
  settings: NectarSettings,
  feature: NectarAiFeature,
): string | null {
  if (!settings.enabled) return NECTAR_REFUSAL_MESSAGE.setting_off;
  return settings[feature] ? null : NECTAR_SETTING_OFF_MESSAGE[feature];
}

/** Nectar is off for the agency (product feature or AI settings), as opposed to a caller problem. */
export function isNectarOff(check: NectarCallerCheck): boolean {
  return !check.ok && (check.reason === "feature_off" || check.reason === "setting_off");
}

/**
 * The agency a Nectar call runs under. With `orgId`, the caller must be an
 * active member of that agency. Without it (the ai-coach functions, whose
 * inputs carry no agency), the first of the caller's agencies with Nectar on
 * is used, in a stable order. With `feature`, that agency's AI settings must
 * have Nectar and the feature on.
 */
export async function checkNectarCaller(
  userId: string | null | undefined,
  deps: NectarCallerDeps,
  opts: NectarCallerOptions = {},
): Promise<NectarCallerCheck> {
  if (!userId) return nectarRefusal("signed_out");
  const active = Array.from(new Set(await deps.loadActiveOrgIds(userId)));
  const candidates = opts.orgId ? active.filter((id) => id === opts.orgId) : active;
  if (candidates.length === 0) return nectarRefusal("not_member");
  const on = new Set(await deps.loadNectarOrgIds(candidates));
  const orgId = [...candidates].sort().find((id) => on.has(id));
  if (!orgId) return nectarRefusal("feature_off");
  if (opts.feature) {
    const refused = aiSettingRefusal(
      nectarSettingsFrom(await deps.loadNectarSettings(orgId)),
      opts.feature,
    );
    if (refused) return nectarRefusal("setting_off", refused);
  }
  return { ok: true, orgId };
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
  return orgIds.filter((id) => own.get(id) ?? registryDefault === true);
}
