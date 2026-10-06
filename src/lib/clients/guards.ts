// Pure rules for "may this actor do X to a client". No Supabase, no aliases —
// importable by node --test. guards.server.ts wires the real requireCategory /
// clients lookup / access_can_see_client behind the `deps` argument.
//
// Reads organization_members.access_level / access_scope only — never the
// legacy `role` column.

import type { CategoryId } from "../access/categories.ts";
import type { AccessLevel, AccessScope } from "../access/levels.ts";

export const MANAGE_CLIENT_ACTIONS = [
  "view",
  "edit",
  "create",
  "discharge",
  "import",
  "view_medical",
  "edit_medical",
  "edit_billing",
  "edit_hrc",
  "edit_funds",
  "edit_loans",
] as const;
export type ManageClientAction = (typeof MANAGE_CLIENT_ACTIONS)[number];

export const NO_PERMISSION_MESSAGE = "You don't have permission to change this";
export const CLIENT_OUT_OF_SCOPE_MESSAGE = "This client isn't in your assigned homes or clients";
export const CLIENT_NOT_FOUND_MESSAGE = "Client not found in this organization";
export const CLIENT_DISCHARGED_MESSAGE =
  "This client is discharged, so their record is read-only. Reactivate them to make changes.";

/** Actions still allowed on a discharged client (reading, and the discharge itself). */
export const DISCHARGED_CLIENT_ACTIONS: ReadonlySet<ManageClientAction> = new Set([
  "view",
  "view_medical",
  "discharge",
]);

/** Which category, at which minimum, each action needs. */
export function categoryForClientAction(action: ManageClientAction): {
  category: CategoryId;
  min: "view" | "edit";
} {
  switch (action) {
    case "view":
      return { category: "clients", min: "view" };
    case "edit":
    case "create":
    case "discharge":
    case "import":
      return { category: "clients", min: "edit" };
    case "view_medical":
      return { category: "client_medical", min: "view" };
    case "edit_medical":
      return { category: "client_medical", min: "edit" };
    case "edit_billing":
    case "edit_funds":
      return { category: "billing", min: "edit" };
    case "edit_hrc":
      return { category: "hrc", min: "edit" };
    case "edit_loans":
      return { category: "loans", min: "edit" };
  }
}

export interface ManageClientGuardInput {
  actorId: string;
  organizationId: string;
  /** Omit for actions with no existing client yet (e.g. create, org-level HRC meeting). */
  clientId?: string | null;
  action: ManageClientAction;
}

export interface ManageClientGuardDeps {
  /** Throws when the actor lacks the category; resolves the actor's level + scope. */
  requireCategory: (
    category: CategoryId,
    min: "view" | "edit",
  ) => Promise<{ level: AccessLevel; scope: AccessScope }>;
  /** The client's organization and whether they are discharged, or null when no row. */
  loadClient: (clientId: string) => Promise<{ organizationId: string; discharged: boolean } | null>;
  /** access_can_see_client(_client, _user). */
  canSeeClient: (clientId: string) => Promise<boolean>;
}

/**
 * Rules in order:
 *  (a) category at the action's minimum,
 *  (b) the client exists and belongs to organizationId,
 *  (c) non-agency-scope actors must be able to see the client,
 *  (d) a discharged client is read-only: only view and discharge actions pass.
 * (b)–(d) are skipped when there is no client yet.
 */
export async function runManageClientGuard(
  input: ManageClientGuardInput,
  deps: ManageClientGuardDeps,
): Promise<{ level: AccessLevel; scope: AccessScope }> {
  const { category, min } = categoryForClientAction(input.action);
  const actor = await deps.requireCategory(category, min);

  const clientId = input.clientId ?? null;
  if (!clientId) return actor;

  const client = await deps.loadClient(clientId);
  if (!client || client.organizationId !== input.organizationId) {
    throw new Error(CLIENT_NOT_FOUND_MESSAGE);
  }

  if (actor.scope !== "agency") {
    const visible = await deps.canSeeClient(clientId);
    if (!visible) throw new Error(CLIENT_OUT_OF_SCOPE_MESSAGE);
  }
  if (client.discharged && !DISCHARGED_CLIENT_ACTIONS.has(input.action)) {
    throw new Error(CLIENT_DISCHARGED_MESSAGE);
  }
  return actor;
}

/** Turn a raw category failure into the plain-English message the UI shows. */
export function friendlyGuardError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("Forbidden")) return new Error(NO_PERMISSION_MESSAGE);
  return err instanceof Error ? err : new Error(msg);
}
