/**
 * Pure rules for Add team member and Import team members. The server fns in
 * members.functions.ts and the dialogs in components/team-members/add share
 * these, so the browser and the server always agree.
 */
import type { AccessLevel } from "../access/levels.ts";

export const WORKER_TYPES = ["w2", "1099", "volunteer", "other"] as const;
export type WorkerType = (typeof WORKER_TYPES)[number];

export const WORKER_TYPE_LABEL: Record<WorkerType, string> = {
  w2: "W2",
  "1099": "1099",
  volunteer: "Volunteer",
  other: "Other",
};

/** Owner has no preset; every other choice is one of the agency's access_presets. */
export const OWNER_ACCESS = "owner" as const;
export type AccessChoice = typeof OWNER_ACCESS | string;

export type PresetPick = {
  id: string;
  name: string;
  access_level: AccessLevel;
};

export type PresetGroup = {
  key: "owner" | "admin" | "staff";
  label: string;
  options: Array<{ value: AccessChoice; label: string }>;
};

/**
 * Access dropdown groups. Owner and Admin presets only show for an Owner —
 * the server enforces the same rule. Import passes includeOwner: false (Owner
 * is never given from a spreadsheet). Empty groups are dropped.
 */
export function presetGroups(
  presets: readonly PresetPick[],
  viewerIsOwner: boolean,
  opts: { includeOwner?: boolean } = {},
): PresetGroup[] {
  const byName = (a: PresetPick, b: PresetPick) => a.name.localeCompare(b.name);
  const groups: PresetGroup[] = [];
  if (viewerIsOwner) {
    if (opts.includeOwner !== false) {
      groups.push({
        key: "owner",
        label: "Owner",
        options: [{ value: OWNER_ACCESS, label: "Owner" }],
      });
    }
    const admin = presets.filter((p) => p.access_level === "admin").sort(byName);
    if (admin.length) {
      groups.push({
        key: "admin",
        label: "Admin presets",
        options: admin.map((p) => ({ value: p.id, label: p.name })),
      });
    }
  }
  const staff = presets.filter((p) => p.access_level === "staff").sort(byName);
  if (staff.length) {
    groups.push({
      key: "staff",
      label: "Team member presets",
      options: staff.map((p) => ({ value: p.id, label: p.name })),
    });
  }
  return groups;
}

/** The DSP preset (by seed, then name), else the first Team member preset. */
export function defaultStaffPresetId(
  presets: ReadonlyArray<PresetPick & { seed_key?: string | null }>,
): string | null {
  const staff = presets.filter((p) => p.access_level === "staff");
  return (
    staff.find((p) => p.seed_key === "dsp")?.id ??
    staff.find((p) => p.name.trim().toLowerCase() === "dsp")?.id ??
    staff[0]?.id ??
    null
  );
}

export type ResolvedAccess = { level: AccessLevel; presetId: string | null };

/** Access level comes from the preset. "owner" → Owner, no preset. Unknown id → null. */
export function resolveAccessChoice(
  choice: AccessChoice,
  presets: readonly PresetPick[],
): ResolvedAccess | null {
  if (choice === OWNER_ACCESS) return { level: "owner", presetId: null };
  const preset = presets.find((p) => p.id === choice);
  if (!preset || preset.access_level === "owner") return null;
  return { level: preset.access_level, presetId: preset.id };
}

/** Owner or an Admin preset takes an Owner to grant. */
export function accessNeedsOwner(level: AccessLevel): boolean {
  return level !== "staff";
}

export type EmailMatch = "new" | "already_here" | "inactive_here" | "other_agency";

export const EMAIL_MATCH_LABEL: Record<EmailMatch, string> = {
  new: "New",
  already_here: "Already here",
  inactive_here: "Inactive here",
  other_agency: "Other agency",
};

/**
 * What an email means for this agency. `profileId` is the exact lower-case
 * email match (never ilike); `membershipActive` is this agency's
 * organization_members.active for that person, or null when they have no row here.
 */
export function classifyEmailMatch(
  profileId: string | null | undefined,
  membershipActive: boolean | null | undefined,
): EmailMatch {
  if (!profileId) return "new";
  if (membershipActive === true) return "already_here";
  if (membershipActive === false) return "inactive_here";
  return "other_agency";
}

/** Same message createEmployeeManually used for someone else's account. */
export const EMAIL_TAKEN_MESSAGE = "An account with this email already exists.";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Worker type from free text (spreadsheets, old labels). Blank → W2. */
export function parseWorkerType(raw: string | null | undefined): WorkerType {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!t || t === "w2" || t === "w-2" || t.startsWith("w2 ") || t === "employee") return "w2";
  if (t === "1099" || t.startsWith("1099") || t === "contractor") return "1099";
  if (t === "volunteer") return "volunteer";
  return "other";
}

/** Import max per save. */
export const IMPORT_MAX_ROWS = 200;
