// Must-knows server functions: read who approved them, let Nectar draft,
// and save what a person approves. Reading needs Clients: View for this
// client; drafting and approving need Clients: Edit (assertCanManageClient).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient, type ManageClientAction } from "./guards.server";
import { approveMustKnows, draftMustKnows, loadMustKnowsView } from "./must-knows.server";
import { MUST_KNOWS_MAX_ITEMS, isMustKnowSection, type MustKnowSection } from "./must-knows";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const scope = z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() });

async function guard(
  context: { supabase?: unknown; userId?: string | null },
  s: z.infer<typeof scope>,
  action: ManageClientAction,
) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const sb = context.supabase as Sb;
  await assertCanManageClient({
    supabase: sb,
    actorId: context.userId,
    organizationId: s.organizationId,
    clientId: s.clientId,
    action,
  });
  return { sb, userId: context.userId };
}

export const getClientMustKnows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const { sb } = await guard(context, data, "view");
    return loadMustKnowsView(sb, data.organizationId, data.clientId);
  });

export const draftClientMustKnows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const { sb } = await guard(context, data, "edit");
    return draftMustKnows(sb, data.organizationId, data.clientId);
  });

const item = z.object({
  section: z.custom<MustKnowSection>(isMustKnowSection, "Unknown must-knows heading."),
  text: z.string().trim().min(1).max(400),
  source_doc_id: z.string().uuid().nullable(),
  source_page: z.number().int().min(1).max(2000).nullable(),
});

export const approveClientMustKnows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope
      .extend({
        items: z.array(item).min(1).max(MUST_KNOWS_MAX_ITEMS),
        basedOn: z.array(z.string().uuid()).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data, "edit");
    await approveMustKnows(sb, {
      orgId: data.organizationId,
      clientId: data.clientId,
      userId,
      items: data.items,
      basedOn: data.basedOn,
    });
    return { ok: true as const };
  });
