import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AccessLevel } from "./levels";

const DEFAULT_SEED: Record<Exclude<AccessLevel, "owner">, string> = {
  admin: "program_manager",
  staff: "dsp",
};

/**
 * Preset id for a hire or invite. An explicit id or name must belong to the
 * agency and match the level. Blank uses the level's built-in default
 * (Admin → Program Manager, Team member → DSP).
 */
export async function resolvePresetId(
  organizationId: string,
  level: Exclude<AccessLevel, "owner">,
  preset: { id?: string | null; name?: string | null },
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("access_presets")
    .select("id, name, access_level, seed_key")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  if (preset.id) {
    const byId = rows.find((p) => p.id === preset.id);
    if (!byId) throw new Error("That preset doesn't exist in this agency");
    if (byId.access_level !== level) throw new Error("That preset is for a different access level");
    return byId.id;
  }

  const name = (preset.name ?? "").trim().toLowerCase();
  if (name && name !== "admin" && name !== "team member" && name !== "team_member") {
    const byName = rows.find((p) => p.name.trim().toLowerCase() === name);
    if (!byName) throw new Error(`No preset named "${preset.name}" in this agency`);
    if (byName.access_level !== level) throw new Error("That preset is for a different access level");
    return byName.id;
  }

  const seed = DEFAULT_SEED[level];
  const fallback =
    rows.find((p) => p.seed_key === seed) ?? rows.find((p) => p.access_level === level);
  if (!fallback) throw new Error("This agency has no preset for that access level");
  return fallback.id;
}
