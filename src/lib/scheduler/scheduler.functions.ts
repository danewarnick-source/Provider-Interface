// Shift writes for the scheduler board (/dashboard/scheduler): save, cancel and
// restore. All run as the calling user (RLS applies) after requireCategory
// (scheduling edit). Saving and restoring run the rule engine through
// shift-guard.server.ts (rules.ts at the agency's strengths). Nothing here
// deletes a shift: a cancelled shift stays on record and can be restored.
// Publishing is in publish.functions.ts; offering open shifts in
// offer.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceScheduledShiftStatus } from "@/lib/scheduler/shift-status";
import { requireCategory } from "@/lib/access/require";
import { guardShiftRows, SHIFT_COLUMNS, type ShiftRowIn } from "@/lib/scheduler/shift-guard.server";

const uuid = z.string().uuid();

const ShiftInput = z
  .object({
    id: uuid.optional(),
    organization_id: uuid,
    staff_id: uuid.nullable(),
    /** A home (team) shift has no client (Decision 1); a 1:1 shift sets both. */
    client_id: uuid.nullable().optional(),
    team_id: uuid.nullable().optional(),
    service_code: z.string().min(1),
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    shift_type: z.string().default("hourly"),
    status: z.string().default("draft"),
    published: z.boolean().default(false),
    notes: z.string().nullable().optional(),
    /** Typed when a rule is set to "Require a reason". */
    override_reason: z.string().max(1000).nullable().optional(),
    /** Unfilled spots on an open shift. */
    open_spots: z.number().int().min(0).max(3).nullable().optional(),
    parent_shift_id: uuid.nullable().optional(),
  })
  .refine((d) => !!d.client_id || !!d.team_id, {
    message: "Pick a client or a home for the shift.",
  });
export type ShiftInput = z.infer<typeof ShiftInput>;

/** Only the optional columns a caller sent, so an update never blanks what it didn't mention. */
function sent<T extends Record<string, unknown>>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

export const saveShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof ShiftInput>) => ShiftInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { id: "", warnings: [] as string[] };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");

    const payload = {
      organization_id: data.organization_id,
      staff_id: data.staff_id,
      service_code: data.service_code.toUpperCase(),
      shift_type: data.shift_type,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      // Never write legacy "pending" — CHECK constraint rejects it.
      status: coerceScheduledShiftStatus(data.status, data.staff_id),
      published: data.published,
      notes: data.notes?.trim() || null,
      override_reason: data.override_reason?.trim() || null,
      ...sent({
        client_id: data.client_id,
        team_id: data.team_id,
        open_spots: data.open_spots,
        parent_shift_id: data.parent_shift_id,
      }),
    };

    // The rule engine: a block refuses with its one line; warnings come back.
    const row: ShiftRowIn = { client_id: null, ...payload, id: data.id };
    const warnings = await guardShiftRows(supabase, data.organization_id, [row], {
      reason: payload.override_reason,
    });

    if (data.id) {
      const { data: rows, error } = await supabase
        .from("scheduled_shifts")
        .update(payload)
        .eq("id", data.id)
        .eq("organization_id", data.organization_id)
        .select("id");
      if (error) throw error;
      if (!rows?.length)
        throw new Error("That shift wasn't saved: it no longer exists or you can't edit it.");
      return { id: data.id, warnings };
    }
    const { data: inserted, error } = await supabase
      .from("scheduled_shifts")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id as string, warnings };
  });

const ShiftRef = z.object({
  id: uuid,
  organization_id: uuid,
  override_reason: z.string().max(1000).nullable().optional(),
});

/** Cancel a shift: it stays on record (status cancelled, cancelled_at) and can be restored. */
export const cancelShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof ShiftRef>) => ShiftRef.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { data: rows, error } = await supabase
      .from("scheduled_shifts")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .select("id");
    if (error) throw error;
    if (!rows?.length)
      throw new Error("That shift wasn't cancelled: it no longer exists or you can't edit it.");
    return { ok: true };
  });

/**
 * Restore a cancelled shift. Its status comes back from what the row still
 * holds: a person and published → published; a person, not published → draft;
 * no person → open. (A claim's "accepted" comes back as "published".) The rule
 * engine runs first, since the week may have changed while it was cancelled.
 */
export const restoreShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof ShiftRef>) => ShiftRef.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false, warnings: [] as string[] };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { data: row, error: rErr } = await supabase
      .from("scheduled_shifts")
      .select(`${SHIFT_COLUMNS}, published`)
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) throw new Error("That shift no longer exists.");
    const shift = row as ShiftRowIn & { published: boolean };
    const status = shift.staff_id ? (shift.published ? "published" : "draft") : "open";
    const reason = data.override_reason?.trim() || null;
    const warnings = await guardShiftRows(supabase, data.organization_id, [{ ...shift, status }], {
      reason,
    });
    const { data: rows, error } = await supabase
      .from("scheduled_shifts")
      .update({ status, cancelled_at: null, ...(reason ? { override_reason: reason } : {}) })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .select("id");
    if (error) throw error;
    if (!rows?.length) throw new Error("That shift wasn't restored: you can't edit it.");
    return { ok: true, warnings };
  });
