// AI settings (N6, Decision 10): Nectar on or off for the agency, and each AI
// feature on or off, with one line on what each does. Stored in
// organizations.nectar_settings (N3); the guard (guard.ts) reads the same
// settings before every AI call. No runtime aliases, so node --test runs it
// on a fake database.

import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import type { NectarDb } from "./ask-types.ts";
import {
  NECTAR_AI_FEATURES,
  nectarSettingsFrom,
  type NectarAiFeature,
  type NectarSettings,
} from "./guard.ts";

export const AI_FEATURE_TEXT: Record<NectarAiFeature, { label: string; help: string }> = {
  ask: {
    label: "Ask",
    help: "Admins and team members can ask questions about policies and plans.",
  },
  note_help: {
    label: "Shift note help",
    help: "Checks notes at clock-out and offers wording team members can accept or reject.",
  },
  pcsp_reading: {
    label: "PCSP reading",
    help: "Drafts goals and must-knows from an uploaded PCSP for an admin to approve.",
  },
  summary_drafts: {
    label: "Summary drafts",
    help: "Drafts quarterly and monthly summaries from that period's notes.",
  },
};

export const NECTAR_ON_HELP =
  "Turning this off turns off every Nectar feature for admins and team members.";

export const AI_SETTINGS_NOTE =
  "Every Nectar answer and draft is labeled as AI. Drafts are never saved to a record until a person accepts them. Questions are logged here for admins, never in the browser.";

export function nectarOnLabel(agencyName: string | null | undefined): string {
  const name = agencyName?.trim();
  return `Nectar is on for ${name || "your agency"}`;
}

const SETTING_KEYS = ["enabled", ...NECTAR_AI_FEATURES] as const;

export const SettingsInput = z
  .object({
    organizationId: z.string().uuid(),
    enabled: z.boolean().optional(),
    ask: z.boolean().optional(),
    note_help: z.boolean().optional(),
    pcsp_reading: z.boolean().optional(),
    summary_drafts: z.boolean().optional(),
  })
  .refine((d) => SETTING_KEYS.some((key) => typeof d[key] === "boolean"), {
    message: "Choose a setting to change.",
  });
export type SettingsInput = z.infer<typeof SettingsInput>;

export type SettingsPatch = Partial<NectarSettings>;

/** The settings after a change; only true/false values for known settings apply. */
export function applySettingsPatch(current: NectarSettings, patch: SettingsPatch): NectarSettings {
  const next = { ...current };
  for (const key of SETTING_KEYS) {
    const value = patch[key];
    if (typeof value === "boolean") next[key] = value;
  }
  return next;
}

/** Each feature's row: shown off, and locked, while Nectar is off for the agency. */
export function featureToggles(settings: NectarSettings) {
  return NECTAR_AI_FEATURES.map((key) => ({
    key,
    ...AI_FEATURE_TEXT[key],
    on: settings.enabled && settings[key],
    disabled: !settings.enabled,
  }));
}

const SETTINGS_SAVE_FAILED = "Could not save the AI settings.";

type Stored = { [key: string]: Json | undefined };

function storedObject(raw: Json | null | undefined): Stored {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

/** Saves a change to organizations.nectar_settings, keeping any other keys stored there. */
export async function saveSettings(
  db: NectarDb,
  orgId: string,
  patch: SettingsPatch,
): Promise<NectarSettings> {
  const { data: row, error } = await db
    .from("organizations")
    .select("nectar_settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !row) throw new Error(SETTINGS_SAVE_FAILED);
  const stored = storedObject(row.nectar_settings);
  const next = applySettingsPatch(nectarSettingsFrom(stored), patch);
  const { data, error: saveError } = await db
    .from("organizations")
    .update({ nectar_settings: { ...stored, ...next } })
    .eq("id", orgId)
    .select("nectar_settings")
    .maybeSingle();
  if (saveError || !data) throw new Error(SETTINGS_SAVE_FAILED);
  return nectarSettingsFrom(data.nectar_settings);
}
