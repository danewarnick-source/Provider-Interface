// The one guardian rule, shared by the profile header, the Contacts section,
// the needs-attention list (overview), the client list's readiness and the
// import field check. Pure: no React, no Supabase.
//
//   own       the client is their own guardian
//   on_file   an active guardian contact with a phone
//   no_phone  an active guardian contact, but none of them has a phone
//   missing   no active guardian contact (and not their own guardian)
//
// "Ready to schedule" needs own or on_file: staff must be able to reach the
// guardian, the same rule the Add client form enforces (name and phone).

import { contactsWithRole, type ClientContact } from "./contacts.ts";

type GuardianContact = Pick<
  ClientContact,
  "role" | "is_primary" | "sort" | "ended_on" | "phone" | "name" | "relationship"
>;

export type GuardianStatus<T extends GuardianContact = GuardianContact> =
  | { kind: "own" }
  | { kind: "missing" }
  | { kind: "on_file" | "no_phone"; guardian: T };

/** Guardian status from the client's own-guardian flag and contacts (ended ones ignored). */
export function guardianStatus<T extends GuardianContact>(
  isOwnGuardian: boolean | null | undefined,
  contacts: readonly T[],
  now: Date = new Date(),
): GuardianStatus<T> {
  if (isOwnGuardian === true) return { kind: "own" };
  const guardians = contactsWithRole(contacts, "guardian", now);
  if (!guardians.length) return { kind: "missing" };
  const reachable = guardians.find((g) => !!g.phone?.trim());
  return reachable
    ? { kind: "on_file", guardian: reachable }
    : { kind: "no_phone", guardian: guardians[0] };
}

/** The setup gap the status leaves, or null when the guardian is covered. */
export function guardianGap(status: Pick<GuardianStatus, "kind">): string | null {
  if (status.kind === "missing") return "Guardian not on file";
  if (status.kind === "no_phone") return "Guardian has no phone";
  return null;
}

/** "Pat Example (Mother)": the name, with the relationship when there is one. */
export function guardianLabel(g: Pick<ClientContact, "name" | "relationship">): string {
  const rel = g.relationship?.trim();
  return rel ? `${g.name} (${rel})` : g.name;
}
