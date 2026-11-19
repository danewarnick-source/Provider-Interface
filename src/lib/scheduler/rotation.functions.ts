// Rotations (B6, Scheduler › Rotations): save a line (add or edit), end it,
// and preview what it would draft. All need Scheduling edit and run as the
// caller (RLS applies). Saving builds the next 4 weeks at once through the
// rule engine (rotation.server.ts): a new line drafts every working day;
// an edit rebuilds only its still-attached unpublished drafts, so hand-edited
// and published shifts stay as they are. Ending sets the last day and cancels
// the attached drafts after it (kept on record). The list is read in the
// browser (components/scheduler/rotations/use-rotations.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { homeCode } from "@/lib/scheduler/board-model";
import { crossesMidnight } from "@/lib/scheduler/rotation";
import { lineFromInput } from "@/lib/scheduler/rotation-form";
import type { DayOutcome } from "@/lib/scheduler/rotation-preview";
import { dayKey } from "@/lib/scheduler/time";
import {
  applyBuild,
  LINE_COLUMNS,
  planBuild,
  rebuildOf,
  type StoredLine,
} from "@/lib/scheduler/rotation.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

const LineInput = z
  .object({
    id: uuid.optional(),
    organization_id: uuid,
    staff_id: uuid.nullable(),
    client_id: uuid.nullable(),
    team_id: uuid.nullable(),
    service_code: z.string().min(1).max(10),
    shift_type: z.string().max(64).nullable(),
    cycle: z.array(z.number().int().min(1).max(28)).min(2).max(14).nullable(),
    weekday_mask: z.number().int().min(0).max(127),
    /** First day of the line; a cycle counts from it. */
    starts_on: ymd,
    start_time: hhmm,
    end_time: hhmm,
    ends_on: ymd.nullable(),
  })
  .refine((d) => !!d.client_id !== !!d.team_id, { message: "Pick a home or a client." })
  .refine((d) => (d.cycle ? d.cycle.length % 2 === 0 : d.weekday_mask > 0), {
    message: "Pick a pattern: on and off days, or at least one weekday.",
  })
  .refine((d) => !d.ends_on || d.ends_on >= d.starts_on, {
    message: "The last day is before the first.",
  });
type LineIn = z.infer<typeof LineInput>;

async function loadLine(db: Db, orgId: string, id: string): Promise<StoredLine> {
  const { data, error } = await db
    .from("recurring_shift_patterns")
    .select(LINE_COLUMNS)
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That rotation no longer exists. Reload the page.");
  return data as StoredLine;
}

/** The code must be the home's, or one of the client's 1056 codes that hasn't ended. */
async function checkCode(db: Db, d: LineIn, today: string) {
  const code = d.service_code.toUpperCase();
  if (d.team_id) {
    const { data } = await db.from("teams").select("team_type").eq("id", d.team_id).maybeSingle();
    if (!data || homeCode(data.team_type) !== code)
      throw new Error(`This home's shifts bill ${homeCode(data?.team_type) ?? "no code"}.`);
    return;
  }
  const { data, error } = await db
    .from("client_billing_codes")
    .select("service_code, service_end_date")
    .eq("client_id", d.client_id)
    .eq("organization_id", d.organization_id);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some(
    (c: { service_code: string; service_end_date: string | null }) =>
      c.service_code.toUpperCase() === code && (!c.service_end_date || c.service_end_date > today),
  );
  if (!ok) throw new Error(`${code} isn't an active code on this client's 1056.`);
}

async function signedIn(context: { supabase?: Db; userId?: string }, orgId: string) {
  const { supabase, userId } = context;
  if (!supabase || !userId) throw new Error("Sign in again to change rotations.");
  await requireCategory(supabase, userId, orgId, "scheduling", "edit");
  return { db: supabase as Db, userId: userId as string };
}

export const previewRotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof LineInput>) => LineInput.parse(d))
  .handler(async ({ data, context }): Promise<DayOutcome[]> => {
    const { db } = await signedIn(context, data.organization_id);
    const stored = data.id ? await loadLine(db, data.organization_id, data.id) : null;
    const line = lineFromInput(data, data.id ?? crypto.randomUUID());
    const build = stored ? rebuildOf(stored, line) : { line, before: null, builtThrough: null };
    const plan = await planBuild(db, data.organization_id, [build], new Date());
    return plan.outcomes.map(({ day, as, message }) => ({ day, as, message }));
  });

export const saveRotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof LineInput>) => LineInput.parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = await signedIn(context, data.organization_id);
    const now = new Date();
    const org = data.organization_id;
    const stored = data.id ? await loadLine(db, org, data.id) : null;
    await checkCode(db, data, dayKey(now));
    const line = lineFromInput(data, stored?.id ?? crypto.randomUUID());
    // Plan (and run the engine) before anything is written.
    const build = stored ? rebuildOf(stored, line) : { line, before: null, builtThrough: null };
    const plan = await planBuild(db, org, [build], now);
    const row = {
      staff_id: line.staff_id,
      client_id: line.client_id,
      team_id: line.team_id,
      service_code: line.service_code,
      shift_type: line.shift_type,
      cycle: line.cycle,
      cycle_start: line.cycle_start,
      weekday_mask: line.weekday_mask,
      start_time_local: line.start_time_local,
      end_time_local: line.end_time_local,
      crosses_midnight: crossesMidnight(line.start_time_local, line.end_time_local),
      effective_from: line.effective_from,
      effective_until: line.effective_until,
    };
    const { error } = stored
      ? await db
          .from("recurring_shift_patterns")
          .update(row)
          .eq("id", line.id)
          .eq("organization_id", org)
      : await db
          .from("recurring_shift_patterns")
          .insert({ ...row, id: line.id, organization_id: org, created_by: userId });
    if (error) throw new Error(`The rotation wasn't saved: ${error.message}`);
    const result = await applyBuild(db, org, plan, userId, now);
    return { id: line.id, ...result };
  });

const EndInput = z.object({ id: uuid, organization_id: uuid, last_day: ymd });

export const endRotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof EndInput>) => EndInput.parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = await signedIn(context, data.organization_id);
    const now = new Date();
    const stored = await loadLine(db, data.organization_id, data.id);
    const plan = await planBuild(
      db,
      data.organization_id,
      [rebuildOf(stored, { ...stored, effective_until: data.last_day })],
      now,
    );
    const { error } = await db
      .from("recurring_shift_patterns")
      .update({ effective_until: data.last_day })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(`The rotation wasn't ended: ${error.message}`);
    return applyBuild(db, data.organization_id, plan, userId, now);
  });
