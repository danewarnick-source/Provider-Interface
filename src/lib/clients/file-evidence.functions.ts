// Client file server functions. The file is the client's Evidence items
// (one source of truth with the Evidence page). Reading needs Clients view;
// changing which packs a client has needs an owner or agency-wide admin with
// Clients edit (the same people Evidence lets write). Item writes (upload,
// waive, undo, add one item) use the Evidence server functions directly.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { isAgencyAdmin } from "@/lib/access/levels";
import { assertCanManageClient } from "@/lib/clients/guards.server";
import type { AnySupabase } from "@/lib/evidence/store.server";
import {
  applyClientPackPlan,
  loadClientFileView,
  markClientPackRemoved,
  recordClientPacks,
} from "@/lib/clients/file-packs.server";
import { CLIENT_PACKS } from "@/lib/clients/file-packs";

const ClientInput = z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() });
const PackInput = ClientInput.extend({
  packKey: z.string().refine((k) => CLIENT_PACKS.some((p) => p.key === k), "Unknown pack"),
});

type Ctx = { supabase: AnySupabase; userId: string };

/** Owners and agency-wide admins with Clients edit (Evidence writes need the same). */
async function requirePackEditor(ctx: Ctx, organizationId: string, clientId: string) {
  await assertCanManageClient({
    supabase: ctx.supabase,
    actorId: ctx.userId,
    organizationId,
    clientId,
    action: "edit",
  });
  const access = await requireCategory(ctx.supabase, ctx.userId, organizationId, "clients", "edit");
  if (!isAgencyAdmin(access.level, access.scope)) {
    throw new Error("Only owners and agency admins can change what's required.");
  }
}

/** Bring the saved file in line with the client's codes and packs. */
async function catchUp(ctx: Ctx, organizationId: string, clientId: string) {
  const view = await loadClientFileView(ctx.supabase, organizationId, clientId);
  if (view.pending)
    await applyClientPackPlan(ctx.supabase, ctx.userId, organizationId, clientId, view);
}

export const loadClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ClientInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertCanManageClient({
      supabase: ctx.supabase,
      actorId: ctx.userId,
      organizationId: data.organizationId,
      clientId: data.clientId,
      action: "view",
    });
    const view = await loadClientFileView(ctx.supabase, data.organizationId, data.clientId);
    return {
      groups: view.groups,
      activePackKeys: view.activePackKeys,
      activeCodes: view.activeCodes,
      agencyHasPacks: view.agencyHasPacks,
      pending: view.pending,
    };
  });

/** Follow the client's codes: add, bring back and retire rows (an admin opening the file runs it). */
export const syncClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ClientInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requirePackEditor(ctx, data.organizationId, data.clientId);
    await catchUp(ctx, data.organizationId, data.clientId);
    return { ok: true as const };
  });

export const addClientFilePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PackInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requirePackEditor(ctx, data.organizationId, data.clientId);
    await recordClientPacks(
      ctx.supabase,
      ctx.userId,
      data.organizationId,
      [data.clientId],
      [data.packKey],
    );
    await catchUp(ctx, data.organizationId, data.clientId);
    return { ok: true as const };
  });

/** Remove a pack: its rows stay on record as "Not needed: Pack removed". */
export const removeClientFilePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PackInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requirePackEditor(ctx, data.organizationId, data.clientId);
    await markClientPackRemoved(
      ctx.supabase,
      ctx.userId,
      data.organizationId,
      data.clientId,
      data.packKey,
    );
    await catchUp(ctx, data.organizationId, data.clientId);
    return { ok: true as const };
  });
