// One client's Overview in one request (see overview-load.ts). The caller
// needs Clients: View and must be able to see this client (scoped managers).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import type { ClientOverview } from "./overview";
import { loadClientOverview } from "./overview-load";

export const getClientOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ClientOverview> => {
    if (!context.supabase || !context.userId) throw new Error("Not signed in.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as SupabaseClient<any>;
    await assertCanManageClient({
      supabase: sb,
      actorId: context.userId,
      organizationId: data.organizationId,
      clientId: data.clientId,
      action: "view",
    });
    return loadClientOverview(sb, data.organizationId, data.clientId);
  });
