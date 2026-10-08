// Client file server functions: the org matrix and the audit pack, built in
// file-index.ts. One client's file is read from Evidence
// (file-evidence.functions.ts).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import {
  loadOrgClientFileIndex,
  type ClientFileMatrixRow,
  type ClientFilePackItem,
} from "@/lib/clients/file-index";
import type { AnySupabase } from "@/lib/clients/file-index-queries";

export const listOrgClientFileMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) return [] as ClientFileMatrixRow[];
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const index = await loadOrgClientFileIndex(supabase, data.organizationId);
    return index.clients;
  });

export const listOrgClientFilePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clientIds: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) return [] as ClientFilePackItem[];
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");
    const index = await loadOrgClientFileIndex(supabase, data.organizationId, data.clientIds);
    const allowed = new Set(data.clientIds);
    return index.pack.filter((p) => allowed.has(p.client_id));
  });
