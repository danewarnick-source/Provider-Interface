// Add client by hand: the form → clients row, authorizations, contacts, home
// pin (create.server.ts). The spreadsheet import saves each row through
// addClient too; "Start from their PCSP" is create-from-pcsp.functions.ts.
// Every call checks assertCanManageClient first.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IMPORT_MAX_ROWS } from "@/lib/team-members/add-member";
import { assertCanManageClient } from "./guards.server";
import { addClientFormSchema } from "./create";
import {
  createClientFromForm,
  medicaidMatches,
  type AddClientResult,
  type MedicaidMatch,
} from "./create.server";

export type { AddClientResult, ExistingClient, MedicaidMatch } from "./create.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const orgScope = { organizationId: z.string().uuid() };

/** Clients here already using any of these Medicaid IDs (Add client and the spreadsheet import). */
export const findClientsByMedicaidIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ ...orgScope, medicaidIds: z.array(z.string().max(50)).min(1).max(IMPORT_MAX_ROWS) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MedicaidMatch[]> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId: data.organizationId,
      action: "create",
    });
    return medicaidMatches(sb, data.organizationId, data.medicaidIds);
  });

/** Save the Add client form. */
export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...orgScope, form: addClientFormSchema }).parse(d))
  .handler(async ({ data, context }): Promise<AddClientResult> => {
    const { sb, userId } = ctx(context);
    const { organizationId, form } = data;
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      action: "create",
    });
    return createClientFromForm(sb, userId, organizationId, form);
  });
