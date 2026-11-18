// Copy week for the scheduler board (B4): previewCopyWeek shows what would
// land (counts, open shifts and skipped ones with their reasons); copyWeek
// inserts the copies as drafts (copy-week.server.ts). The target is 1 to 4
// weeks after the source week. Both need scheduling edit and run as the
// caller (RLS applies). Undo cancels the copies with cancelShift, so they
// stay on record.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { insertCopies, planCopy, type CopyPlan } from "@/lib/scheduler/copy-week.server";
import { daysBetween, weekStartKey } from "@/lib/scheduler/time";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Input = z
  .object({
    organization_id: z.string().uuid(),
    from_week: ymd,
    to_week: ymd,
    /** "all", "community" or a teams.id. */
    scope: z.string().min(1).max(64),
  })
  .refine(
    (d) => weekStartKey(d.from_week) === d.from_week && weekStartKey(d.to_week) === d.to_week,
    {
      message: "Pick whole weeks (Sunday to Saturday).",
    },
  )
  .refine((d) => [7, 14, 21, 28].includes(daysBetween(d.from_week, d.to_week)), {
    message: "Copy to one of the next 4 weeks.",
  });
type In = z.input<typeof Input>;

/** What the dialog shows: no shift rows, only counts and the lines to list. */
export type CopyPreview = {
  source: number;
  drafts: number;
  open: { sourceId: string; message: string }[];
  notes: { sourceId: string; message: string }[];
  skipped: CopyPlan["skipped"];
};

function preview(plan: CopyPlan): CopyPreview {
  const lines = (as: "open" | "draft") =>
    plan.copies.flatMap((c) => {
      const o = c.outcome;
      if (o.as !== as) return [];
      const message = o.as === "open" ? o.message : o.note;
      return message ? [{ sourceId: c.sourceId, message }] : [];
    });
  return {
    source: plan.source,
    drafts: plan.copies.filter((c) => c.outcome.as === "draft").length,
    open: lines("open"),
    notes: lines("draft"),
    skipped: plan.skipped,
  };
}

export const previewCopyWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: In) => Input.parse(d))
  .handler(async ({ data, context }): Promise<CopyPreview> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to copy a week.");
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    return preview(
      await planCopy(supabase, data.organization_id, data.from_week, data.to_week, data.scope),
    );
  });

export const copyWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: In) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to copy a week.");
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const plan = await planCopy(
      supabase,
      data.organization_id,
      data.from_week,
      data.to_week,
      data.scope,
    );
    if (!plan.copies.length)
      throw new Error("Nothing to copy: every shift is already there or can't be copied.");
    const ids = await insertCopies(supabase, data.organization_id, userId, plan.copies);
    return { ids, ...preview(plan) };
  });
