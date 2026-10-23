// What getClientCareData sends back, by who is asking. People with Clients:
// View get the full identity (Medicaid ID), contacts, goals, codes and custom
// fields; people with Client medical: View get the full medication list (both
// only for clients in their scope). Everyone else gets the staff view only:
// the top-level fields are replaced with visibility.staffCare, so the network
// response carries nothing the staff screens don't show. Pure.

import type { CategoryId, CategoryValue } from "../access/categories.ts";
import { hasCategory } from "../access/can.ts";
import type { AccessScope } from "../access/levels.ts";

/** Contact roles staff screens show (About tab, quick info). */
export const STAFF_CONTACT_ROLES: ReadonlySet<string> = new Set([
  "guardian",
  "emergency",
  "support_coordinator",
  "primary_doctor",
]);

export function staffContacts<T extends { role?: string | null }>(contacts: readonly T[]): T[] {
  return contacts.filter((c) => !!c.role && STAFF_CONTACT_ROLES.has(c.role));
}

export interface CareDataReach {
  /** Full identity, contacts, goals, codes and custom fields. */
  fullRecord: boolean;
  /** Full medication list. */
  fullMedical: boolean;
}

/** Which full parts the caller may have. Out of scope means the staff view only. */
export function careDataReach(args: {
  categories: Record<CategoryId, CategoryValue>;
  scope: AccessScope;
  /** access_can_see_client for this client (only consulted when scope isn't agency). */
  canSeeClient: boolean;
}): CareDataReach {
  const inScope = args.scope === "agency" || args.canSeeClient;
  return {
    fullRecord: inScope && hasCategory(args.categories, "clients", "view"),
    fullMedical: inScope && hasCategory(args.categories, "client_medical", "view"),
  };
}

export interface ScopableCareData<I, M, C, G, A, F> {
  identity: I;
  medications: M[];
  contacts: C[];
  goals: G[];
  authorized_codes: A[];
  custom_fields: F[];
  visibility: {
    staffCare: {
      identity: I;
      medications: M[];
      contacts: C[];
      goals: G[];
      authorized_codes: A[];
      custom_fields: F[];
    };
  };
}

/** The payload with every part the caller can't have swapped for its staff view. */
export function scopeCareData<I, M, C, G, A, F, T extends ScopableCareData<I, M, C, G, A, F>>(
  data: T,
  reach: CareDataReach,
): T {
  const staff = data.visibility.staffCare;
  return {
    ...data,
    identity: reach.fullRecord ? data.identity : staff.identity,
    contacts: reach.fullRecord ? data.contacts : staff.contacts,
    goals: reach.fullRecord ? data.goals : staff.goals,
    authorized_codes: reach.fullRecord ? data.authorized_codes : staff.authorized_codes,
    custom_fields: reach.fullRecord ? data.custom_fields : staff.custom_fields,
    medications: reach.fullMedical ? data.medications : staff.medications,
  };
}
