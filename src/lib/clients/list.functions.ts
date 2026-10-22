// The client list in one request: rows (codes, home, units left, next due,
// team members, readiness), counts per view, filter options and whether the
// org has referrals. Search and filters run here, not in the browser.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { hasCategory } from "@/lib/access/can";
import { LIST_VIEWS } from "./list";
import { loadClientList, type ClientListResult } from "./list-load";

export const listClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        view: z.enum(LIST_VIEWS).default("active"),
        search: z.string().max(100).default(""),
        code: z.string().max(10).nullish(),
        homeId: z.string().uuid().nullish(),
        staffId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ClientListResult> => {
    if (!context.supabase || !context.userId) throw new Error("Not signed in.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as SupabaseClient<any>;
    const access = await requireCategory(
      sb,
      context.userId,
      data.organizationId,
      "clients",
      "view",
    );
    return loadClientList(
      sb,
      data.organizationId,
      {
        view: data.view,
        search: data.search,
        code: data.code ?? null,
        homeId: data.homeId ?? null,
        staffId: data.staffId ?? null,
      },
      { referralsVisible: hasCategory(access.categories, "hosts", "view") },
    );
  });
