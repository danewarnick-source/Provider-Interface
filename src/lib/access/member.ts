// One member row → resolved access. Shared by the server guards and the client hook
// so both read the same columns and apply the same rules.

import type { CategoryId, CategoryValue } from "./categories.ts";
import { effectiveCategories } from "./can.ts";
import type { AccessLevel, AccessScope } from "./levels.ts";

/** Columns to select from organization_members (embeds the preset). */
export const MEMBER_ACCESS_SELECT =
  "access_level, access_scope, access_preset_id, access_overrides, access_presets(name, categories, home_page)";

export interface MemberAccessRow {
  access_level: string | null;
  access_scope: string | null;
  access_preset_id: string | null;
  access_overrides: unknown;
  access_presets: { name: string; categories: unknown; home_page: string | null } | null;
}

export interface MemberAccess {
  level: AccessLevel;
  scope: AccessScope;
  presetId: string | null;
  presetName: string | null;
  presetHome: string | null;
  categories: Record<CategoryId, CategoryValue>;
}

const LEVELS: readonly string[] = ["owner", "admin", "staff"];
const SCOPES: readonly string[] = ["agency", "assigned", "self"];

export function resolveMemberAccess(row: MemberAccessRow): MemberAccess {
  const level = (LEVELS.includes(row.access_level ?? "") ? row.access_level : "staff") as AccessLevel;
  const scope = (
    level === "owner" ? "agency" : SCOPES.includes(row.access_scope ?? "") ? row.access_scope : "self"
  ) as AccessScope;
  const preset = level === "owner" ? null : row.access_presets;
  return {
    level,
    scope,
    presetId: preset ? row.access_preset_id : null,
    presetName: preset?.name ?? null,
    presetHome: preset?.home_page ?? null,
    categories: effectiveCategories({
      level,
      presetCategories: preset?.categories,
      overrides: row.access_overrides,
    }),
  };
}

export const HRC_HOME = "/dashboard/hrc";

/** Staff whose preset lands on the HRC page (e.g. outside committee members) see only HRC. */
export function isCommitteeOnly(access: Pick<MemberAccess, "level" | "presetHome"> | null | undefined): boolean {
  return access?.level === "staff" && access.presetHome === HRC_HOME;
}
