// Who a library document is for (N3, Decision 5). Pure: no Supabase, no
// aliases, so node --test can import it.
//
// Two options only: "All team members" (audience_all = true, the default) or
// "Only the people I check" (audience_all = false, policy_assigned_users holds
// the checked people's user ids). Only those people see it, are asked to
// review it, and get Nectar answers from it. Owners and agency-wide admins
// manage every document whoever it is for.

export interface AudienceFields {
  audience_all: boolean | null;
  policy_assigned_users: readonly string[] | null;
}

export interface VisibleFields extends AudienceFields {
  library_status: string | null;
}

export type AudienceChoice = { all: true } | { all: false; userIds: string[] };

/** True when the document is meant for this person. A missing flag counts as "all". */
export function isInAudience(doc: AudienceFields, userId: string): boolean {
  if (doc.audience_all !== false) return true;
  return (doc.policy_assigned_users ?? []).includes(userId);
}

/** A team member sees a library document only when it is published and meant for them. */
export function isVisibleToMember(doc: VisibleFields, userId: string): boolean {
  return doc.library_status === "published" && isInAudience(doc, userId);
}

/** The active team members a document is for, in the order given. */
export function audienceMembers(doc: AudienceFields, activeMemberIds: readonly string[]): string[] {
  if (doc.audience_all !== false) return [...activeMemberIds];
  const checked = new Set(doc.policy_assigned_users ?? []);
  return activeMemberIds.filter((id) => checked.has(id));
}

/**
 * The columns to save for a choice. Checked ids must be active members of the
 * agency (anything else is dropped); "All team members" clears the list.
 */
export function audienceColumns(
  choice: AudienceChoice,
  activeMemberIds: readonly string[],
): { audience_all: boolean; policy_assigned_users: string[] } {
  if (choice.all) return { audience_all: true, policy_assigned_users: [] };
  const active = new Set(activeMemberIds);
  const ids = [...new Set(choice.userIds)].filter((id) => active.has(id));
  return { audience_all: false, policy_assigned_users: ids };
}

/** The warning the Who it's for panel shows when nobody is checked. */
export function audienceWarning(doc: AudienceFields): string | null {
  return doc.audience_all === false && (doc.policy_assigned_users ?? []).length === 0
    ? "Nobody is checked, so no team member will see this document."
    : null;
}
