// Client file server functions: the org matrix, one client's required
// documents, and the audit pack. The index itself is built in file-index.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { requiredDocuments, type RequiredDocRow } from "@/lib/clients/file-required";
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

/** One client's required documents (status, expiry, file on record) for the Client file section. */
export const listClientRequiredDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<RequiredDocRow[]> => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) return [];
    await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    const index = await loadOrgClientFileIndex(supabase, data.organizationId, [data.clientId]);
    const facts = index.factsByClient.get(data.clientId);
    return facts ? requiredDocuments(data.clientId, facts) : [];
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
