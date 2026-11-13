// Find staff and the checks for one shift, for the scheduler board. Both run
// the rule engine only (find-staff.server.ts → rules.ts; checkShiftRows in
// shift-guard.server.ts); nothing is saved here. findStaff needs scheduling
// edit (it's for assigning); shiftChecks and weekChecks need scheduling view
// (the chip flags, the drawer and Add shift's "For Ava" card).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { checkShiftRows, SHIFT_COLUMNS, type ShiftRowIn } from "@/lib/scheduler/shift-guard.server";
import type { Finding } from "@/lib/scheduler/rules-types";
import { rankCandidates } from "@/lib/scheduler/find-staff.server";

const uuid = z.string().uuid();

const Proposed = z
  .object({
    id: uuid.optional(),
    staff_id: uuid.nullable().optional(),
    client_id: uuid.nullable(),
    team_id: uuid.nullable(),
    service_code: z.string().min(1),
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    shift_type: z.string().nullable().optional(),
    parent_shift_id: uuid.nullable().optional(),
  })
  .refine((d) => !!d.client_id || !!d.team_id, { message: "Pick a client or a home first." });

const Input = z.object({ organization_id: uuid, shift: Proposed });
type In = z.input<typeof Input>;

export type Check = { rule: string; level: Finding["level"]; message: string; href: string | null };
const toCheck = ({ rule, level, message, fix }: Finding): Check => ({
  rule,
  level,
  message,
  href: fix?.href ?? null,
});

const row = (s: z.infer<typeof Proposed>) => ({
  ...s,
  staff_id: s.staff_id ?? null,
  service_code: s.service_code.toUpperCase(),
  status: "draft",
});

/** Every active team member for this shift, best fit first, with the engine's reasons. */
export const findStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: In) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    return rankCandidates(supabase, data.organization_id, row(data.shift));
  });

/** The engine's findings for one shift as it stands (or as proposed). */
export const shiftChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: In) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "view");
    const { findings } = await checkShiftRows(supabase, data.organization_id, [row(data.shift)]);
    return findings.map(toCheck);
  });

/** Findings for every staffed, live shift in a range (the board's chip flags and the drawer's checks), by shift id. */
export const weekChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; start_iso: string; end_iso: string }) =>
    z
      .object({ organization_id: uuid, start_iso: z.string().min(1), end_iso: z.string().min(1) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return {};
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "view");
    const { data: rows, error } = await supabase
      .from("scheduled_shifts")
      .select(SHIFT_COLUMNS)
      .eq("organization_id", data.organization_id)
      .neq("status", "cancelled")
      .not("staff_id", "is", null)
      .gte("starts_at", data.start_iso)
      .lt("starts_at", data.end_iso);
    if (error) throw error;
    const { findings } = await checkShiftRows(
      supabase,
      data.organization_id,
      (rows ?? []) as ShiftRowIn[],
    );
    const out: Record<string, Check[]> = {};
    for (const f of findings) if (f.shiftId) (out[f.shiftId] ??= []).push(toCheck(f));
    return out;
  });
