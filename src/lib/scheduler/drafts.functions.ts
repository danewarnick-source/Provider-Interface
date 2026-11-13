// Accept a batch of Nectar / auto-fill drafts (the scheduler's Nectar bar).
// New drafts become shifts; auto-fill drafts put a team member on an open
// shift. The whole batch runs the rule engine first (shift-guard.server.ts):
// one refusal stops the batch, with its one-line reason.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { guardShiftRows, SHIFT_COLUMNS, type ShiftRowIn } from "@/lib/scheduler/shift-guard.server";

const Draft = z.object({
  // Nectar new shifts
  staff_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  service_code: z.string().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Auto-fill: put staff_id on this existing open shift
  assign_to_shift_id: z.string().uuid().nullable().optional(),
});
const Input = z.object({ organization_id: z.string().uuid(), drafts: z.array(Draft) });

export const applyDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof Input>) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase, userId } = context as any;
    if (!supabase || !userId) return { created: 0, assigned: 0, warnings: [] as string[] };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");

    const assigns = data.drafts.filter((d) => d.assign_to_shift_id && d.staff_id);
    const inserts = data.drafts
      .filter(
        (d) => !d.assign_to_shift_id && d.client_id && d.service_code && d.starts_at && d.ends_at,
      )
      .map((d) => ({
        organization_id: data.organization_id,
        staff_id: d.staff_id ?? null,
        client_id: d.client_id!,
        service_code: d.service_code!.toUpperCase(),
        starts_at: d.starts_at!,
        ends_at: d.ends_at!,
        status: d.staff_id ? "draft" : "open",
        published: false,
        shift_type: "hourly",
        notes: d.notes ?? null,
        created_by: userId,
        created_from: "nectar",
      }));

    let targets: ShiftRowIn[] = [];
    if (assigns.length) {
      const { data: rows, error } = await supabase
        .from("scheduled_shifts")
        .select(SHIFT_COLUMNS)
        .eq("organization_id", data.organization_id)
        .in(
          "id",
          assigns.map((d) => d.assign_to_shift_id!),
        );
      if (error) throw error;
      targets = (rows ?? []) as ShiftRowIn[];
      if (targets.length < new Set(assigns.map((d) => d.assign_to_shift_id)).size) {
        throw new Error(
          "One of those open shifts no longer exists. Refresh the schedule and try again.",
        );
      }
    }
    const staffFor = new Map(assigns.map((d) => [d.assign_to_shift_id!, d.staff_id!] as const));
    const proposed = [
      ...targets.map((t) => ({ ...t, staff_id: staffFor.get(t.id!)!, status: "draft" })),
      ...inserts,
    ];
    const warnings = await guardShiftRows(supabase, data.organization_id, proposed);

    for (const t of targets) {
      const { error } = await supabase
        .from("scheduled_shifts")
        .update({ staff_id: staffFor.get(t.id!)!, status: "draft" })
        .eq("id", t.id)
        .eq("organization_id", data.organization_id);
      if (error) throw error;
    }
    if (inserts.length) {
      const { error } = await supabase.from("scheduled_shifts").insert(inserts);
      if (error) throw error;
    }
    return { created: inserts.length, assigned: targets.length, warnings };
  });
