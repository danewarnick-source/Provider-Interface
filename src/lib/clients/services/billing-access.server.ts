// Whether the caller may write a client's service codes (client_billing_codes):
// Billing: Edit, in scope, for this client (or for the agency when the client
// is being created). Used by the PCSP confirm paths, which save everything
// else without it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertCanManageClient } from "../guards.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

/** Never throws: false when the person lacks billing access. */
export async function canEditClientBilling(
  sb: Sb,
  userId: string,
  organizationId: string,
  clientId?: string | null,
): Promise<boolean> {
  try {
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      clientId,
      action: "edit_billing",
    });
    return true;
  } catch {
    return false;
  }
}
