// Scheduler server functions for the code-section scheduler at
// /dashboard/scheduler. All writes go through `requireSupabaseAuth` so RLS
// is enforced as the calling user. Saving runs the rule engine through
// shift-guard.server.ts (rules.ts at the agency's strengths); publishing is in
// publish.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceScheduledShiftStatus } from "@/lib/scheduler/shift-status";
import { requireCategory } from "@/lib/access/require";
import { guardShiftRows } from "@/lib/scheduler/shift-guard.server";

const ShiftInput = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable(),
  client_id: z.string().uuid(),
  service_code: z.string().min(1),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  shift_type: z.string().default("hourly"),
  status: z.string().default("draft"),
  published: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  /** Typed when a rule is set to "Require a reason". */
  override_reason: z.string().max(1000).nullable().optional(),
});
export type ShiftInput = z.infer<typeof ShiftInput>;

export const saveShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ShiftInput) => ShiftInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { id: "", warnings: [] as string[] };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");

    const payload = {
      organization_id: data.organization_id,
      staff_id: data.staff_id,
      client_id: data.client_id,
      service_code: data.service_code.toUpperCase(),
      shift_type: data.shift_type,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      // Never write legacy "pending" — CHECK constraint rejects it.
      status: coerceScheduledShiftStatus(data.status, data.staff_id),
      published: data.published,
      notes: data.notes?.trim() || null,
      override_reason: data.override_reason?.trim() || null,
      created_by: userId,
    };

    // The rule engine: a block refuses with its one line; warnings come back.
    const warnings = await guardShiftRows(supabase, data.organization_id, [{ ...payload, id: data.id }], {
      reason: payload.override_reason,
    });

    if (data.id) {
      const { error } = await supabase
        .from("scheduled_shifts")
        .update(payload)
        .eq("id", data.id)
        .eq("organization_id", data.organization_id);
      if (error) throw error;
      return { id: data.id, warnings };
    }
    const { data: row, error } = await supabase
      .from("scheduled_shifts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string, warnings };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; organization_id: string }) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { error } = await supabase
      .from("scheduled_shifts")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw error;
    return { ok: true };
  });

export const setAdminTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organization_id: string; staff_id: string; date: string; on: boolean }) =>
      z.object({
        organization_id: z.string().uuid(),
        staff_id: z.string().uuid(),
        date: z.string().min(8),
        on: z.boolean(),
      }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    if (data.on) {
      // Insert an approved single-day time off (admin-initiated).
      const { error } = await supabase.from("time_off_requests").insert({
        organization_id: data.organization_id,
        staff_id: data.staff_id,
        start_date: data.date,
        end_date: data.date,
        type: "pto",
        status: "approved",
        decided_by: userId,
        decided_at: new Date().toISOString(),
        note: "Admin-marked from scheduler",
      });
      if (error) throw error;
    } else {
      // Remove approved single-day rows that exactly cover this date.
      const { error } = await supabase
        .from("time_off_requests")
        .delete()
        .eq("organization_id", data.organization_id)
        .eq("staff_id", data.staff_id)
        .eq("start_date", data.date)
        .eq("end_date", data.date)
        .eq("status", "approved");
      if (error) throw error;
    }
    return { ok: true };
  });

export const saveAdminHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organization_id: string; client_id: string; hours: number | null }) =>
      z.object({
        organization_id: z.string().uuid(),
        client_id: z.string().uuid(),
        hours: z.number().min(0).max(168).nullable(),
      }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { ok: false };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { error } = await supabase
      .from("clients")
      .update({ admin_hours_per_week: data.hours })
      .eq("id", data.client_id)
      .eq("organization_id", data.organization_id);
    if (error) throw error;
    return { ok: true };
  });

// ============================================================
// Day Program
// ============================================================

export const saveDayProgramSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    session_date: string;
    service_code: "DSG" | "DSP";
    location_label: string | null;
    start_time: string;
    end_time: string;
  }) =>
    z.object({
      id: z.string().uuid().optional(),
      organization_id: z.string().uuid(),
      session_date: z.string().min(8),
      service_code: z.enum(["DSG", "DSP"]),
      location_label: z.string().nullable(),
      start_time: z.string().min(1),
      end_time: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { id: "", warnings: [] as string[] };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    if (data.id) {
      const { error } = await supabase
        .from("day_program_sessions")
        .update({
          session_date: data.session_date,
          service_code: data.service_code,
          location_label: data.location_label,
          start_time: data.start_time,
          end_time: data.end_time,
        })
        .eq("id", data.id)
        .eq("organization_id", data.organization_id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("day_program_sessions")
      .insert({
        organization_id: data.organization_id,
        session_date: data.session_date,
        service_code: data.service_code,
        location_label: data.location_label,
        start_time: data.start_time,
        end_time: data.end_time,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireSessionEdit(supabase: any, userId: string, sessionId: string) {
  const { data: session, error } = await supabase
    .from("day_program_sessions")
    .select("organization_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error("That session no longer exists.");
  await requireCategory(supabase, userId, session.organization_id, "scheduling", "edit");
}

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    session_id: string;
    client_id: string;
    attended: boolean;
  }) =>
    z.object({
      session_id: z.string().uuid(),
      client_id: z.string().uuid(),
      attended: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { ok: false };
    await requireSessionEdit(supabase, userId, data.session_id);
    const { error } = await supabase
      .from("day_program_attendance")
      .upsert(
        {
          session_id: data.session_id,
          client_id: data.client_id,
          attended: data.attended,
        },
        { onConflict: "session_id,client_id" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const addSessionStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string; staff_id: string }) =>
    z.object({
      session_id: z.string().uuid(),
      staff_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { ok: false };
    await requireSessionEdit(supabase, userId, data.session_id);
    const { error } = await supabase
      .from("day_program_session_staff")
      .upsert(
        { session_id: data.session_id, staff_id: data.staff_id },
        { onConflict: "session_id,staff_id", ignoreDuplicates: true },
      );
    if (error) throw error;
    return { ok: true };
  });
