// Discharge server functions: preview what a discharge ends, let Nectar draft
// the summary, discharge (one transaction in discharge_client, then the team
// comes off the client), keep the summary and its 7-day clock, and reactivate.
// Every call runs assertCanManageClient first. Nothing is deleted from the
// client's record: authorizations are ended, shifts cancelled, the discharge
// row is kept when the client is reactivated.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient, type ManageClientAction } from "./guards.server";
import { assertRowsChanged } from "./writes";
import { dischargeProblems, INITIATED_BY, parseEndedItems, type EndedItems } from "./discharge";
import { draftDischargeSummaryText } from "./discharge-summary.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const scope = z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() });
const initiatedBy = z.enum(Object.keys(INITIATED_BY) as [keyof typeof INITIATED_BY]);

async function guard(
  context: { supabase?: unknown; userId?: string | null },
  s: z.infer<typeof scope>,
  action: ManageClientAction,
) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const sb = context.supabase as Sb;
  await assertCanManageClient({
    supabase: sb,
    actorId: context.userId,
    organizationId: s.organizationId,
    clientId: s.clientId,
    action,
  });
  return { sb, userId: context.userId };
}

export type DischargeRecord = {
  id: string;
  discharge_date: string;
  reason: string;
  initiated_by: keyof typeof INITIATED_BY;
  notice_date: string | null;
  summary_text: string | null;
  summary_drafted_by_nectar: boolean;
  summary_confirmed_at: string | null;
  summary_sent_on: string | null;
  ended: EndedItems;
};

const RECORD_COLUMNS =
  "id, discharge_date, reason, initiated_by, notice_date, summary_text, summary_drafted_by_nectar, summary_confirmed_at, summary_sent_on, ended_items";

/** The client's open discharge (not reactivated), or null. */
export const getClientDischarge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }): Promise<DischargeRecord | null> => {
    const { sb } = await guard(context, data, "view");
    const { data: row, error } = await sb
      .from("client_discharges")
      .select(RECORD_COLUMNS)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .is("reactivated_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const { ended_items, ...rest } = row as Record<string, unknown>;
    return { ...(rest as Omit<DischargeRecord, "ended">), ended: parseEndedItems(ended_items) };
  });

export type DischargePreview = {
  ended: EndedItems;
  /** Authorizations that start after the discharge date (left as they are). */
  upcoming: { id: string; service_code: string; service_start_date: string }[];
};

/** What a discharge on this date would end. */
export const previewDischarge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.extend({ dischargeDate: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<DischargePreview> => {
    const { sb } = await guard(context, data, "discharge");
    const { data: out, error } = await sb.rpc("client_discharge_preview", {
      _client: data.clientId,
      _discharge_date: data.dischargeDate,
    });
    if (error) throw new Error(error.message);
    const o = (out ?? {}) as Record<string, unknown>;
    return {
      ended: parseEndedItems(o),
      upcoming: Array.isArray(o.upcoming_authorizations)
        ? (o.upcoming_authorizations as DischargePreview["upcoming"])
        : [],
    };
  });

/** Nectar drafts the summary from what is on file. A person confirms it. */
export const draftDischargeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope.extend({ dischargeDate: z.string(), reason: z.string().max(2000), initiatedBy }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb } = await guard(context, data, "discharge");
    return { text: await draftDischargeSummaryText(sb, data) };
  });

const dischargeInput = scope.extend({
  dischargeDate: z.string(),
  reason: z.string(),
  initiatedBy: z.union([initiatedBy, z.literal("")]),
  noticeDate: z.string(),
  summaryText: z.string().max(20000),
  summaryDraftedByNectar: z.boolean(),
  summaryConfirmed: z.boolean(),
});

/**
 * Discharge: ends active authorizations, cancels future shifts, moves the
 * client to Discharged and records it (one transaction), then takes the team
 * off the client. teamLeft > 0 means some team members couldn't be removed.
 */
export const dischargeClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dischargeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { sb } = await guard(context, data, "discharge");
    const problems = dischargeProblems(data);
    if (problems.length) throw new Error(problems.join(" "));
    const summary = data.summaryText.trim();
    const { data: id, error } = await sb.rpc("discharge_client", {
      _client: data.clientId,
      _discharge_date: data.dischargeDate,
      _reason: data.reason.trim(),
      _initiated_by: data.initiatedBy,
      _notice_date: (data.noticeDate || null) as string,
      _summary_text: (summary || null) as string,
      _summary_drafted_by_nectar: data.summaryDraftedByNectar,
      _summary_confirmed: data.summaryConfirmed,
    });
    if (error) throw new Error(error.message);
    const { error: teamErr } = await sb
      .from("staff_assignments")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId);
    const { count } = await sb
      .from("staff_assignments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId);
    if (teamErr) console.warn("[discharge] team removal failed:", teamErr.message);
    return { id: id as string, teamLeft: count ?? 0 };
  });

/** Save (and optionally confirm) the discharge summary. Confirmed text is final. */
export const saveDischargeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope
      .extend({
        dischargeId: z.string().uuid(),
        text: z.string().max(20000),
        draftedByNectar: z.boolean(),
        confirm: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data, "discharge");
    const text = data.text.trim();
    if (data.confirm && !text) throw new Error("There is no summary to confirm.");
    const { data: rows, error } = await sb
      .from("client_discharges")
      .update({
        summary_text: text || null,
        summary_drafted_by_nectar: data.draftedByNectar && !!text,
        summary_confirmed_at: data.confirm ? new Date().toISOString() : null,
        summary_confirmed_by: data.confirm ? userId : null,
      })
      .eq("id", data.dischargeId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .is("summary_confirmed_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { ok: true };
  });

/** Record the day the confirmed summary was sent. Stops the 7-day clock. */
export const markDischargeSummarySent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope.extend({ dischargeId: z.string().uuid(), sentOn: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb } = await guard(context, data, "discharge");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.sentOn)) throw new Error("Pick the date it was sent.");
    const { data: rows, error } = await sb
      .from("client_discharges")
      .update({ summary_sent_on: data.sentOn })
      .eq("id", data.dischargeId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .not("summary_confirmed_at", "is", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Confirm the summary before marking it sent.");
    return { ok: true };
  });

/** Back to active. History stays: ended authorizations and cancelled shifts aren't undone. */
export const reactivateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const { sb } = await guard(context, data, "discharge");
    const { error } = await sb.rpc("reactivate_client", { _client: data.clientId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
