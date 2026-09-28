// Pure rules for "may this actor do X to that team member". No Supabase, no
// aliases — importable by node --test. guards.server.ts wires the real
// requireCategory / organization_members / access_can_see_staff behind the
// `deps` argument of runManageMemberGuard.

import type { CategoryId } from "../access/categories.ts";
import { isOwner, type AccessLevel, type AccessScope } from "../access/levels.ts";

export const MANAGE_MEMBER_ACTIONS = [
  "deactivate",
  "reactivate",
  "reset_password",
  "invite",
  "edit_profile",
  "edit_caseload",
] as const;
export type ManageMemberAction = (typeof MANAGE_MEMBER_ACTIONS)[number];

export const OWNER_ONLY_MESSAGE = "Only an Owner can do this to an Owner";
export const SELF_ACTION_MESSAGE = "You can't do this to your own account";
export const OUT_OF_SCOPE_MESSAGE = "This team member isn't in your assigned homes, team members, or clients";
export const TARGET_NOT_FOUND_MESSAGE = "Team member not found in this organization";

/** Rule (a): which category, at Edit, each action needs. */
export function categoryForAction(action: ManageMemberAction): { category: CategoryId; min: "edit" } {
  switch (action) {
    case "edit_profile":
    case "edit_caseload":
      return { category: "staff_roster", min: "edit" };
    case "deactivate":
    case "reactivate":
    case "reset_password":
    case "invite":
      return { category: "staff_hiring", min: "edit" };
  }
}

/** Rule (d): the two actions nobody may run against themselves. */
export function isSelfBlockedAction(action: ManageMemberAction): boolean {
  return action === "deactivate" || action === "reset_password";
}

export interface ManageMemberGuardInput {
  actorId: string;
  /** Omit for actions with no existing target yet (e.g. inviting a new email). */
  targetUserId?: string | null;
  action: ManageMemberAction;
}

export interface ManageMemberGuardDeps {
  /** Rule (a). Throws when the actor lacks the category; resolves the actor's level + scope. */
  requireCategory: (
    category: CategoryId,
    min: "edit",
  ) => Promise<{ level: AccessLevel; scope: AccessScope }>;
  /** Rule (b). access_can_see_staff(_org, _staff, _viewer). */
  canSeeStaff: (targetUserId: string) => Promise<boolean>;
  /** Rule (c). organization_members.access_level for the target (any active flag); null when no row. */
  loadTargetLevel: (targetUserId: string) => Promise<string | null>;
}

/**
 * Rules in the order the spec lists them:
 *  (a) category Edit for the action,
 *  (b) non-agency-scope actors must be able to see the target,
 *  (c) only an Owner may act on an Owner,
 *  (d) nobody deactivates or resets their own account.
 * Target-relative rules (b–d) are skipped when there is no target user yet.
 */
export async function runManageMemberGuard(
  input: ManageMemberGuardInput,
  deps: ManageMemberGuardDeps,
): Promise<{ level: AccessLevel; scope: AccessScope }> {
  const { category, min } = categoryForAction(input.action);
  const actor = await deps.requireCategory(category, min);

  const target = input.targetUserId ?? null;
  if (!target) return actor;

  if (actor.scope !== "agency") {
    const visible = await deps.canSeeStaff(target);
    if (!visible) throw new Error(OUT_OF_SCOPE_MESSAGE);
  }

  const targetLevel = await deps.loadTargetLevel(target);
  if (targetLevel === null) throw new Error(TARGET_NOT_FOUND_MESSAGE);
  if (isOwner(targetLevel) && !isOwner(actor.level)) throw new Error(OWNER_ONLY_MESSAGE);

  if (input.actorId === target && isSelfBlockedAction(input.action)) {
    throw new Error(SELF_ACTION_MESSAGE);
  }

  return actor;
}
