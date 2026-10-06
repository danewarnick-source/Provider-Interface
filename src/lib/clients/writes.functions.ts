// Every browser-side client write goes through these server functions.
// Each one runs assertCanManageClient first, then writes with the caller's
// own (RLS-scoped) Supabase client and confirms a row really changed, so a
// blocked save shows "You don't have permission to change this" instead of
// a false "Saved".

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import type { ManageClientAction } from "./guards";
import {
  CLIENT_RECORD_TABLE_NAMES,
  actionsForClientPatch,
  assertRowsChanged,
  stampRows,
  stripScopeColumns,
  tableConfig,
  type ClientRecordTable,
} from "./writes";
import { CLIENT_NOT_FOUND_MESSAGE } from "./guards";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const patchSchema = z.record(z.string(), z.unknown());

/** Update one clients row. The fields that actually change decide which access is needed. */
export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clientId: z.string().uuid(),
        patch: patchSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId, patch } = data;
    const keys = Object.keys(patch);
    if (keys.length === 0) return { id: clientId };
    const { data: before, error: readErr } = await sb
      .from("clients")
      .select(keys.join(","))
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!before) throw new Error(CLIENT_NOT_FOUND_MESSAGE);
    for (const action of actionsForClientPatch(
      before as unknown as Record<string, unknown>,
      patch,
    )) {
      await assertCanManageClient({
        supabase: sb,
        actorId: userId,
        organizationId,
        clientId,
        action,
      });
    }
    const { data: rows, error } = await sb
      .from("clients")
      .update(patch)
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: clientId };
  });

/**
 * Add a client (Clients: Edit). Returns the new id. `stubCodes` are $0
 * placeholder authorization rows for the codes picked on the add form (part of
 * adding the client, so they need only Clients: Edit).
 */
export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        values: patchSchema,
        stubCodes: z
          .array(
            z.object({
              service_code: z.string().min(1).max(10),
              unit_type: z.enum(["day", "unit"]),
            }),
          )
          .max(50)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, values } = data;
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      action: "create",
    });
    const { id: _id, created_at: _c, ...rest } = values;
    const { data: rows, error } = await sb
      .from("clients")
      .insert({ ...rest, organization_id: organizationId })
      .select("id");
    if (error) throw new Error(error.message);
    const [row] = assertRowsChanged(rows as Array<{ id: string }> | null);
    if (data.stubCodes?.length) {
      const stubs = data.stubCodes.map((c) => ({
        ...c,
        organization_id: organizationId,
        client_id: row.id,
        annual_unit_authorization: 0,
        rate_per_unit: 0,
      }));
      const { error: bcErr } = await sb
        .from("client_billing_codes")
        .upsert(stubs, { onConflict: "organization_id,client_id,service_code" });
      if (bcErr) throw new Error(bcErr.message);
    }
    return { id: row.id };
  });

async function assertParentBelongs(
  sb: Sb,
  cfg: ClientRecordTable,
  parentIds: unknown[],
  organizationId: string,
  clientId: string | null,
): Promise<void> {
  if (typeof cfg.key !== "object") return;
  const ids = [...new Set(parentIds)];
  if (!clientId || ids.some((v) => typeof v !== "string"))
    throw new Error(CLIENT_NOT_FOUND_MESSAGE);
  const { data, error } = await sb
    .from(cfg.key.parent)
    .select("id")
    .in("id", ids as string[])
    .eq("organization_id", organizationId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== ids.length) throw new Error(CLIENT_NOT_FOUND_MESSAGE);
}

const recordSchema = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  table: z.enum(CLIENT_RECORD_TABLE_NAMES as [string, ...string[]]),
  op: z.enum(["insert", "update", "upsert", "delete"]),
  /** insert/upsert: one row or many. update: the changed columns. */
  values: z.union([patchSchema, z.array(patchSchema)]).optional(),
  /** update/delete: the row id. */
  id: z.string().uuid().optional(),
  onConflict: z.string().max(200).optional(),
});

/**
 * Insert/update/upsert/delete on one of the allow-listed client tables
 * (see CLIENT_RECORD_TABLES). Scoping columns are forced from the request.
 */
export const writeClientRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ids: string[] }> => {
    const { sb, userId } = ctx(context);
    const { organizationId, table, op, id, onConflict } = data;
    const clientId = data.clientId ?? null;
    const cfg = tableConfig(table, op);
    if (cfg.key !== "org" && !clientId) throw new Error("A client is required for this change");
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      clientId,
      action: cfg.action as ManageClientAction,
    });

    let result: { data: unknown; error: { message: string } | null };
    if (op === "insert" || op === "upsert") {
      const raw = data.values;
      if (!raw) throw new Error("Nothing to save");
      const rows = stampRows(cfg, Array.isArray(raw) ? raw : [raw], organizationId, clientId);
      if (typeof cfg.key === "object") {
        const fk = cfg.key.fk;
        await assertParentBelongs(
          sb,
          cfg,
          rows.map((r) => r[fk]),
          organizationId,
          clientId,
        );
      }
      const q = sb.from(table);
      result =
        op === "insert"
          ? await q.insert(rows).select("id")
          : await q.upsert(rows, onConflict ? { onConflict } : undefined).select("id");
    } else {
      if (!id) throw new Error("A record id is required");
      if (typeof cfg.key === "object") {
        const fk = cfg.key.fk;
        const { data: existing, error } = await sb
          .from(table)
          .select(fk)
          .eq("id", id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        const parentId = (existing as Record<string, unknown> | null)?.[fk];
        await assertParentBelongs(sb, cfg, [parentId], organizationId, clientId);
      }
      const base = sb.from(table);
      let q =
        op === "update"
          ? base.update(stripScopeColumns((data.values as Record<string, unknown>) ?? {}))
          : base.delete();
      q = q.eq("id", id);
      if (cfg.hasOrgColumn) q = q.eq("organization_id", organizationId);
      if (cfg.key === "client") q = q.eq("client_id", clientId as string);
      result = await q.select("id");
    }
    if (result.error) throw new Error(result.error.message);
    const rows = assertRowsChanged(result.data as Array<{ id: string }> | null);
    return { ids: rows.map((r) => r.id) };
  });
