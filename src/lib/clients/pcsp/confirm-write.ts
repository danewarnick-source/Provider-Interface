// Writes a confirmed PCSP review. Takes the caller's Supabase client; the
// server function runs assertCanManageClient first. Nothing is deleted:
// the old current plan becomes 'past' (insertPlan), its goals stay with it,
// and authorizations are upserted per code.

import { normalizeCodes } from "../plans.ts";
import { insertPlan } from "../plans-write.ts";
import { assertRowsChanged } from "../writes.ts";
import {
  billingRows, blockHeading, carriedFrom, confirmProblems, contactRows, mergePcspBlock, riskLines,
} from "./confirm-plan.ts";
import type { ReviewedPcsp } from "./review.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (table: string) => any };

export interface ConfirmArgs {
  organizationId: string;
  clientId: string;
  userId: string;
  documentId: string;
  review: ReviewedPcsp;
  now: string;
}

export interface ConfirmResult {
  planId: string;
  goals: number;
  supports: number;
  codes: string[];
  contacts: number;
}

function fail(error: { message: string } | null | undefined) {
  if (error) throw new Error(error.message);
}

export async function applyReviewedPcsp(sb: Sb, a: ConfirmArgs): Promise<ConfirmResult> {
  const problems = confirmProblems(a.review);
  if (problems.length) throw new Error(problems.join(" "));

  const { data: doc, error: docErr } = await sb
    .from("client_documents").select("id, document_type")
    .eq("id", a.documentId).eq("client_id", a.clientId).eq("organization_id", a.organizationId).maybeSingle();
  fail(docErr);
  if (!doc || String((doc as { document_type: string }).document_type).toLowerCase() !== "pcsp") {
    throw new Error("That PCSP upload wasn't found for this client. Upload it again.");
  }

  // Goals on the plan being replaced, so carried-over goals point at real rows.
  const { data: cur, error: curErr } = await sb
    .from("client_plans").select("id").eq("client_id", a.clientId).eq("status", "current").maybeSingle();
  fail(curErr);
  let currentGoalIds = new Set<string>();
  if (cur) {
    const { data: g, error } = await sb.from("client_goals").select("id").eq("plan_id", (cur as { id: string }).id);
    fail(error);
    currentGoalIds = new Set(((g ?? []) as { id: string }[]).map((x) => x.id));
  }

  const { plan } = a.review;
  const planId = await insertPlan(sb, {
    organizationId: a.organizationId, clientId: a.clientId, userId: a.userId, source: "pcsp_upload",
    start_date: plan.start, end_date: plan.end, activated_on: plan.activatedOn, meeting_date: plan.meetingDate,
    document_id: a.documentId,
  });

  let goals = 0, supports = 0;
  for (const g of a.review.goals.filter((x) => x.include && x.goal.trim())) {
    const clean = (s: string) => s.trim() || null;
    const { data: rows, error } = await sb.from("client_goals").insert({
      organization_id: a.organizationId, client_id: a.clientId, plan_id: planId, sort: goals,
      goal_text: g.goal.trim(), domain: clean(g.domain), current_status: clean(g.currentStatus),
      strengths: clean(g.strengths), barriers: clean(g.barriers),
      success_person: clean(g.successPerson), success_team: clean(g.successTeam),
      carried_from_goal_id: carriedFrom(g, currentGoalIds), created_by: a.userId,
    }).select("id");
    fail(error);
    const goalId = (assertRowsChanged(rows as unknown[])[0] as { id: string }).id;
    goals++;
    const supportRows = g.supports.map((s, sort) => ({
      organization_id: a.organizationId, goal_id: goalId, sort,
      support_text: s.support.trim(), details: s.details.trim() || null,
      start_date: s.start, end_date: s.end, our_codes: normalizeCodes(s.ourCodes),
      other_providers: s.providers.filter((p) => !p.ours).map((p) => ({ code: p.code, provider: p.provider })),
      health_needs: s.healthNeeds.map((h) => (h.category ? `${h.category}: ${h.description}` : h.description)).filter(Boolean),
    }));
    if (supportRows.length) {
      const { error: sErr } = await sb.from("client_goal_supports").insert(supportRows);
      fail(sErr);
      supports += supportRows.length;
    }
  }

  const codes = billingRows(a.review, { ...a });
  if (codes.length) {
    const { data, error } = await sb
      .from("client_billing_codes").upsert(codes, { onConflict: "organization_id,client_id,service_code" }).select("id");
    fail(error);
    assertRowsChanged(data as unknown[]);
  }

  const { data: client, error: cErr } = await sb
    .from("clients").select("special_directions").eq("id", a.clientId).maybeSingle();
  fail(cErr);
  const c = (client ?? {}) as { special_directions?: string | null };
  const patch = {
    special_directions: mergePcspBlock(c.special_directions, blockHeading(a.review), riskLines(a.review)),
  };
  if (patch.special_directions !== (c.special_directions ?? null)) {
    const { data, error } = await sb.from("clients").update(patch).eq("id", a.clientId).select("id");
    fail(error);
    assertRowsChanged(data as unknown[]);
  }

  const { data: existing, error: eErr } = await sb.from("client_contacts").select("name, sort").eq("client_id", a.clientId);
  fail(eErr);
  const ex = (existing ?? []) as { name: string; sort: number }[];
  const contacts = contactRows(a.review, {
    organizationId: a.organizationId, clientId: a.clientId,
    existingNames: ex.map((x) => x.name), startSort: ex.reduce((m, x) => Math.max(m, (x.sort ?? 0) + 1), 0),
  });
  if (contacts.length) {
    const { error } = await sb.from("client_contacts").insert(contacts.map((x) => ({ ...x, created_by: a.userId })));
    fail(error);
  }

  return { planId, goals, supports, codes: codes.map((x) => x.service_code), contacts: contacts.length };
}
