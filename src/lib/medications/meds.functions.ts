// Client medication server functions. Every call runs assertCanManageClient
// first (view_medical to read, edit_medical to change), then uses the
// service client. The rules and writes live in meds-write.ts and
// meds-actions.ts (tested).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "@/lib/clients/guards.server";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  EDITABLE_COLUMNS,
  listMedications,
  medicationOwner,
  saveMedicationRow,
  type MedicationInput,
  type Sb,
} from "./meds-write";
import { listChanges, sendMedicationRow, setMedicationStatusRow } from "./meds-actions";

export type ClientMedication = Database["public"]["Tables"]["client_medications"]["Row"];

async function admin(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Sb;
}

async function clientOrg(sb: Sb, clientId: string): Promise<string> {
  const { data, error } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client not found.");
  return (data as { organization_id: string }).organization_id;
}

function signedIn(context: { userId?: string | null; supabase?: unknown }) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return context as {
    userId: string;
    supabase: Parameters<typeof assertCanManageClient>[0]["supabase"];
  };
}

/** Guard a medication by id: resolves its client and agency, then checks the action. */
async function guardMedication(
  ctx: ReturnType<typeof signedIn>,
  sb: Sb,
  id: string,
  action: "view_medical" | "edit_medical",
) {
  const owner = await medicationOwner(sb, id);
  await assertCanManageClient({
    supabase: ctx.supabase,
    actorId: ctx.userId,
    organizationId: owner.organizationId,
    clientId: owner.clientId,
    action,
  });
  return owner;
}

export const listClientMedications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ clientId: z.string().uuid(), includeStopped: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = signedIn(context);
    const sb = await admin();
    const organizationId = await clientOrg(sb, data.clientId);
    await assertCanManageClient({
      supabase: ctx.supabase,
      actorId: ctx.userId,
      organizationId,
      clientId: data.clientId,
      action: "view_medical",
    });
    const rows = await listMedications(sb, data.clientId, { includeStopped: data.includeStopped });
    return rows as unknown as ClientMedication[];
  });

const MedicationInputSchema = z
  .object(Object.fromEntries(EDITABLE_COLUMNS.map((c) => [c, z.unknown().optional()])))
  .strict()
  .superRefine((v, ctx) => {
    if (v.how_taken != null && !["self", "assist", "nurse"].includes(String(v.how_taken))) {
      ctx.addIssue({ code: "custom", path: ["how_taken"], message: "Choose how they take it." });
    }
    if (
      v.scheduled_times != null &&
      !(Array.isArray(v.scheduled_times) && v.scheduled_times.every((t) => typeof t === "string"))
    ) {
      ctx.addIssue({ code: "custom", path: ["scheduled_times"], message: "Times must be a list." });
    }
  });

export const saveMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        clientId: z.string().uuid(),
        id: z.string().uuid().nullable().optional(),
        medication: MedicationInputSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = signedIn(context);
    const sb = await admin();
    const organizationId = await clientOrg(sb, data.clientId);
    await assertCanManageClient({
      supabase: ctx.supabase,
      actorId: ctx.userId,
      organizationId,
      clientId: data.clientId,
      action: "edit_medical",
    });
    const saved = await saveMedicationRow(sb, {
      organizationId,
      clientId: data.clientId,
      userId: ctx.userId,
      id: data.id ?? null,
      input: data.medication as MedicationInput,
    });
    return { id: saved.id, changes: saved.changes as unknown as Json };
  });

export const setMedicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["pause", "resume", "stop"]),
        reason: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = signedIn(context);
    const sb = await admin();
    await guardMedication(ctx, sb, data.id, "edit_medical");
    await setMedicationStatusRow(sb, {
      userId: ctx.userId,
      id: data.id,
      action: data.action,
      reason: data.reason,
    });
    return { ok: true };
  });

export const sendMedicationWithClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        to: z.string().trim().min(1).max(120),
        quantity: z.number().int().positive().max(10000),
        receivedBy: z.string().trim().min(1).max(120),
        note: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = signedIn(context);
    const sb = await admin();
    await guardMedication(ctx, sb, data.id, "edit_medical");
    const { data: profile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", ctx.userId)
      .maybeSingle();
    const userName = (profile as { full_name?: string | null } | null)?.full_name || "Staff";
    await sendMedicationRow(sb, { userId: ctx.userId, userName, ...data });
    return { ok: true };
  });

export const listMedicationChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ medicationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = signedIn(context);
    const sb = await admin();
    await guardMedication(ctx, sb, data.medicationId, "view_medical");
    const rows = await listChanges(sb, data.medicationId);
    const ids = [...new Set(rows.map((r) => r.changed_by).filter((v): v is string => !!v))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: people } = await sb.from("profiles").select("id, full_name").in("id", ids);
      for (const p of (people ?? []) as Array<{ id: string; full_name: string | null }>)
        names.set(p.id, p.full_name ?? "");
    }
    return rows.map((r) => ({
      ...r,
      changes: r.changes as unknown as Json,
      changed_by_name: (r.changed_by && names.get(r.changed_by)) || null,
    }));
  });
