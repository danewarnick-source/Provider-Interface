// Settings › Homes rules: who can see and change homes, what a home's details
// may hold, when a home can be archived, and which homes the list shows. Pure:
// the Settings › Homes pages and homes.functions.ts both call these, so the
// screen and the server agree.
//
// Access: homes are agency setup the scheduler runs on. Seeing them takes an
// Owner or Admin with Scheduling: View; changing them takes the Owner or an
// agency-wide Admin with Scheduling: Edit (RLS on teams and staffing needs is
// is_org_admin_or_manager: Owner or agency-wide Admin).

import type { CategoryValue } from "../access/categories.ts";
import { isAdminLevel, isAgencyAdmin, type AccessLevel } from "../access/levels.ts";
import { HOME_KINDS, type HomeKind } from "./home-kind.ts";

export function homesAccess(a: {
  level: AccessLevel | null | undefined;
  scope: string | null | undefined;
  scheduling: CategoryValue | null | undefined;
}): { canView: boolean; canEdit: boolean } {
  const canView = isAdminLevel(a.level) && (a.scheduling === "view" || a.scheduling === "edit");
  const canEdit = canView && a.scheduling === "edit" && isAgencyAdmin(a.level, a.scope);
  return { canView, canEdit };
}

export const MAX_NAME = 80;
export const MAX_ADDRESS = 200;
export const MAX_CAPACITY = 99;
export const MAX_REASON = 500;

/** A home's details as the editor sends them; absent fields are left alone. */
export type HomePatch = {
  team_name?: string;
  team_type?: HomeKind;
  manager_id?: string | null;
  address?: string | null;
  capacity?: number | null;
};

/** What's wrong with a patch, in plain words; empty when it can be saved. */
export function homePatchProblems(p: HomePatch): string[] {
  const out: string[] = [];
  if (p.team_name !== undefined) {
    const name = p.team_name.trim();
    if (!name) out.push("Give the home a name.");
    else if (name.length > MAX_NAME) out.push(`Keep the name under ${MAX_NAME} characters.`);
  }
  if (p.team_type !== undefined && !HOME_KINDS.some((k) => k.value === p.team_type))
    out.push("Pick the kind of home.");
  if (p.address != null && p.address.trim().length > MAX_ADDRESS)
    out.push(`Keep the address under ${MAX_ADDRESS} characters.`);
  if (
    p.capacity != null &&
    (!Number.isInteger(p.capacity) || p.capacity < 1 || p.capacity > MAX_CAPACITY)
  )
    out.push(`Licensed capacity is a whole number from 1 to ${MAX_CAPACITY}, or blank.`);
  return out;
}

/** The patch as stored: names and addresses trimmed, a blank address is null. */
export function cleanHomePatch(p: HomePatch): HomePatch {
  const out: HomePatch = { ...p };
  if (p.team_name !== undefined) out.team_name = p.team_name.trim();
  if (p.address !== undefined) out.address = p.address?.trim() || null;
  return out;
}

/** "12" → 12, "" → null, anything else → NaN (refused by homePatchProblems). */
export function capacityFromText(text: string): number | null {
  const t = text.trim();
  return t === "" ? null : /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

/** Why Archive is off: anyone still living here. null when the home can be archived. */
export function archiveBlockedReason(residentCount: number): string | null {
  return residentCount > 0 ? "Move its residents first" : null;
}

/** The archive reason as stored, or the problem with it. */
export function archiveReason(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Say why the home is being archived." };
  if (value.length > MAX_REASON)
    return { ok: false, error: `Keep the reason under ${MAX_REASON} characters.` };
  return { ok: true, value };
}

export type HomeListRow = {
  id: string;
  name: string;
  kind: HomeKind;
  leadName: string | null;
  residents: number;
  active: boolean;
  archivedAt: string | null;
};

/** Active homes by name; with Show archived, archived homes follow, greyed by the list. */
export function visibleHomes(rows: readonly HomeListRow[], showArchived: boolean): HomeListRow[] {
  const byName = (a: HomeListRow, b: HomeListRow) => a.name.localeCompare(b.name);
  const active = rows.filter((r) => r.active).sort(byName);
  return showArchived ? [...active, ...rows.filter((r) => !r.active).sort(byName)] : active;
}
