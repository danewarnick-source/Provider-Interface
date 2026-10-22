// Services & billing server functions: load the section, add or edit an
// authorization, and End one (sets the end date — authorizations are never
// deleted). Writes need Billing: Edit for this client (assertCanManageClient).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { assertCanManageClient } from "./guards.server";
import { assertRowsChanged } from "./writes";
import {
  authorizationProblems,
  authorizationValues,
  endProblems,
} from "./authorizations";
import { authorizationSaveTarget } from "./authorization-renewal";
import { todayYmd } from "./dates";
import {
  loadAgencyCodes,
  loadAuthorizationRows,
  loadClientServices,
  type ClientServices,
} from "./services-load";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };

export const getClientServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(scope).parse(d))
  .handler(async ({ data, context }): Promise<ClientServices> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({ supabase: sb, actorId: userId, ...data, action: "view" });
    await requireCategory(sb, userId, data.organizationId, "billing", "view");
    return loadClientServices(sb, data.organizationId, data.clientId);
  });

const inputSchema = z.object({
  code: z.string().max(8),
  unitType: z.string().max(10),
  rate: z.number().nullable(),
  annualUnits: z.number().nullable(),
  monthlyMaxUnits: z.number().nullable().optional(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  authorizationNumber: z.string().max(60).nullable().optional(),
  approvedOn: z.string().nullable().optional(),
});

/**
 * Add (no id) or edit (id) an authorization. Adding a code the client already
 * has renews an ended row as a new period (authorization-renewal.ts: it must
 * start after the old one ended; a trigger keeps the old period, 1056 number
 * included, in history); an open row must be edited or ended first.
 */
export const saveAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...scope, id: z.string().uuid().nullable(), input: inputSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      clientId,
      action: "edit_billing",
    });
    const problems = authorizationProblems(data.input, await loadAgencyCodes(sb, organizationId));
    if (problems.length) throw new Error(problems.join(" "));

    const existing = await loadAuthorizationRows(sb, organizationId, clientId);
    const target = authorizationSaveTarget(existing, data.id, data.input, todayYmd());
    if (target.kind === "error") throw new Error(target.message);
    const targetId = target.kind === "insert" ? null : target.id;
    const values = {
      ...authorizationValues(data.input),
      rate_source: "Entered by hand",
      rate_source_at: new Date().toISOString(),
    };
    const q = targetId
      ? sb
          .from("client_billing_codes")
          .update(values)
          .eq("id", targetId)
          .eq("client_id", clientId)
          .eq("organization_id", organizationId)
      : sb
          .from("client_billing_codes")
          .insert({ ...values, organization_id: organizationId, client_id: clientId });
    const { data: out, error } = await q.select("id");
    if (error) throw new Error(error.message);
    return { id: assertRowsChanged(out as { id: string }[])[0].id };
  });

/** End an authorization on `endOn` (no new shifts or billing after it). */
export const endAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...scope, id: z.string().uuid(), endOn: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      clientId,
      action: "edit_billing",
    });
    const row = (await loadAuthorizationRows(sb, organizationId, clientId)).find(
      (r) => r.id === data.id,
    );
    if (!row) throw new Error("That authorization wasn't found for this client.");
    const problems = endProblems(row, data.endOn);
    if (problems.length) throw new Error(problems.join(" "));
    const { data: out, error } = await sb
      .from("client_billing_codes")
      .update({ service_end_date: data.endOn })
      .eq("id", data.id)
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(out as unknown[]);
    return { id: data.id };
  });
