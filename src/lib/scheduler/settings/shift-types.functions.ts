// Settings › Shift types: add a type, set whether it counts toward a home's
// coverage, and remove one (archived with a reason; shifts that used it keep
// it). Owner only. B3 offers these types as time choices when adding a shift.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { isOwner } from "@/lib/access/levels";

const OWNER_ONLY = "Only the owner can change shift types.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function ownerDb(
  context: { supabase?: unknown; userId?: string | null },
  orgId: string,
): Promise<{ db: Db; userId: string }> {
  const { supabase, userId } = context as { supabase: unknown; userId: string | null };
  if (!supabase || !userId) throw new Error("Sign in again to change shift types.");
  const access = await requireOrgMembership(supabase as Db, userId, orgId).catch(() => {
    throw new Error(OWNER_ONLY);
  });
  if (!isOwner(access.level)) throw new Error(OWNER_ONLY);
  return { db: supabase, userId };
}

const Time = z.string().regex(/^\d{2}:\d{2}$/);
const NewType = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1, "Give the shift type a name.").max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  startTime: Time,
  endTime: Time,
  usedAt: z.enum(["home", "program", "client"]),
  countsTowardCoverage: z.boolean(),
  payKind: z.enum(["normal", "sleep", "stipend"]),
});

export const addShiftType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof NewType>) => NewType.parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = await ownerDb(context, data.organizationId);
    const { data: row, error } = await db
      .from("shift_types")
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        color: data.color,
        start_time: data.startTime,
        end_time: data.endTime,
        used_at: [data.usedAt],
        counts_toward_coverage: data.countsTowardCoverage,
        pay_kind: data.payKind,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const setShiftTypeCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; typeId: string; counts: boolean }) =>
    z
      .object({ organizationId: z.string().uuid(), typeId: z.string().uuid(), counts: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db } = await ownerDb(context, data.organizationId);
    const { error } = await db
      .from("shift_types")
      .update({ counts_toward_coverage: data.counts })
      .eq("id", data.typeId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Your own types only; built-in types can't be removed. */
export const removeShiftType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; typeId: string; reason: string }) =>
    z
      .object({
        organizationId: z.string().uuid(),
        typeId: z.string().uuid(),
        reason: z.string().trim().min(3, "Say why it's being removed.").max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db } = await ownerDb(context, data.organizationId);
    const { data: rows, error } = await db
      .from("shift_types")
      .update({ archived_at: new Date().toISOString(), archive_reason: data.reason })
      .eq("id", data.typeId)
      .eq("organization_id", data.organizationId)
      .eq("built_in", false)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length)
      throw new Error("Built-in shift types can't be removed. Rename or recolor them instead.");
    return { ok: true };
  });
