// Writes a confirmed PCSP review: the one writer for everything a PCSP fills
// (plan year, goals, supports, authorizations, blank profile
// fields, support coordinator and other-provider contacts). Takes the
// caller's Supabase client; the server function runs assertCanManageClient
// first. Authorizations (client_billing_codes) are written only when the
// caller also has Billing: Edit (canEditBilling); otherwise everything else
// is saved and the codes come back in codesHeld. Nothing is deleted:
// the old current plan becomes 'past', its goals stay with it, and
// authorizations are upserted per code. Reads and checks happen first; then
// every write is one database transaction (apply_reviewed_pcsp), so a
// failure part way leaves the old plan current and nothing half-saved.

import { normalizeCodes, planStatusOn, type PlanStatus } from "../plans/plans.ts";
import { todayYmd } from "../dates.ts";
import {
  billingRows, carriedFrom, confirmProblems, contactRows,
} from "./confirm-plan.ts";
import { coordinatorRow, profilePatch, type ClientProfileRow } from "./confirm-profile.ts";
import type { ReviewedPcsp, ReviewSupport } from "./review.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };

/** goal_text of the row that holds a plan's non-goal supports (client_goals.kind 'other_need'). */
export const OTHER_NEEDS_GOAL = "Other needs in the PCSP";

export interface ConfirmArgs {
  organizationId: string;
  clientId: string;
  userId: string;
  documentId: string;
  review: ReviewedPcsp;
  now: string;
  /** Billing: Edit for this client. Without it the service codes are not written. */
  canEditBilling: boolean;
}

export interface ConfirmResult {
  planId: string;
  goals: number;
  supports: number;
  codes: string[];
  contacts: number;
  /** Profile fields filled from the PCSP ("PID", "phone", …). */
  profile: string[];
  /** Service codes not written because the person has no billing access. */
  codesHeld: string[];
}

/** Which reviewed codes are written, and which wait for someone with billing access. */
export function splitCodesByBilling<T extends { service_code: string }>(
  codes: readonly T[],
  canEditBilling: boolean,
): { write: T[]; held: string[] } {
  return canEditBilling
    ? { write: [...codes], held: [] }
    : { write: [], held: codes.map((c) => c.service_code) };
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

  const { data: client, error: cErr } = await sb
    .from("clients").select("client_pid, date_of_birth, phone_number, physical_address")
    .eq("id", a.clientId).maybeSingle();
  fail(cErr);
  const { data: existing, error: eErr } = await sb.from("client_contacts").select("name, role, sort").eq("client_id", a.clientId);
  fail(eErr);

  const w = pcspWrite(a, {
    currentGoalIds,
    client: (client ?? {}) as Partial<ClientProfileRow>,
    contacts: (existing ?? []) as ExistingContact[],
    today: todayYmd(),
  });

  // One transaction (apply_reviewed_pcsp): a failure anywhere leaves the old plan current.
  const { data: planId, error } = await sb.rpc("apply_reviewed_pcsp", {
    _organization_id: a.organizationId,
    _client_id: a.clientId,
    _actor: a.userId,
    _document_id: a.documentId,
    _plan: w.plan,
    _goals: w.goals,
    _codes: w.codes,
    _client_patch: w.clientPatch,
    _contacts: w.contacts,
  });
  fail(error);
  if (!planId) throw new Error("The plan wasn't saved. Try again.");

  return {
    planId: planId as string,
    goals: w.goals.length,
    supports: w.goals.reduce((n, g) => n + g.supports.length, 0),
    codes: w.codes.map((x) => x.service_code),
    contacts: w.contacts.length,
    profile: w.profileFilled,
    codesHeld: w.codesHeld,
  };
}

type ExistingContact = { name: string; role: string | null; sort: number };

export interface PcspGoalWrite {
  goal_text: string;
  kind?: "other_need";
  domain?: string | null;
  current_status?: string | null;
  strengths?: string | null;
  barriers?: string | null;
  success_person?: string | null;
  success_team?: string | null;
  carried_from_goal_id?: string | null;
  supports: {
    support_text: string;
    details: string | null;
    start_date: string | null;
    end_date: string | null;
    our_codes: string[];
    other_providers: { code: string; provider: string }[];
    health_needs: string[];
  }[];
}

export interface PcspWrite {
  plan: { start_date: string | null; end_date: string | null; activated_on: string | null; meeting_date: string | null; status: PlanStatus };
  goals: PcspGoalWrite[];
  codes: ReturnType<typeof billingRows>;
  codesHeld: string[];
  clientPatch: Partial<ClientProfileRow>;
  profileFilled: string[];
  contacts: Record<string, unknown>[];
}

/** Everything the confirm writes, worked out before the one database call. Pure. */
export function pcspWrite(
  a: ConfirmArgs,
  read: { currentGoalIds: Set<string>; client: Partial<ClientProfileRow>; contacts: readonly ExistingContact[]; today: string },
): PcspWrite {
  const { plan } = a.review;
  const dates = { start_date: plan.start ?? null, end_date: plan.end ?? null };
  const status = planStatusOn({ ...dates, status: "current" }, read.today);

  const clean = (s: string) => s.trim() || null;
  const supportsOf = (list: ReviewSupport[]): PcspGoalWrite["supports"] =>
    list.map((s) => ({
      support_text: s.support.trim(), details: s.details.trim() || null,
      start_date: s.start, end_date: s.end, our_codes: normalizeCodes(s.ourCodes),
      other_providers: s.providers.filter((p) => !p.ours).map((p) => ({ code: p.code, provider: p.provider })),
      health_needs: s.healthNeeds.map((h) => (h.category ? `${h.category}: ${h.description}` : h.description)).filter(Boolean),
    }));
  const goals: PcspGoalWrite[] = a.review.goals.filter((x) => x.include && x.goal.trim()).map((g) => ({
    goal_text: g.goal.trim(), domain: clean(g.domain), current_status: clean(g.currentStatus),
    strengths: clean(g.strengths), barriers: clean(g.barriers),
    success_person: clean(g.successPerson), success_team: clean(g.successTeam),
    carried_from_goal_id: carriedFrom(g, read.currentGoalIds),
    supports: supportsOf(g.supports),
  }));
  // Kept non-goal supports go under one "Other needs in the PCSP" row.
  const otherNeeds = a.review.otherNeeds.filter((x) => x.include && x.support.trim());
  if (otherNeeds.length) goals.push({ goal_text: OTHER_NEEDS_GOAL, kind: "other_need", supports: supportsOf(otherNeeds) });

  const { write: codes, held: codesHeld } = splitCodesByBilling(billingRows(a.review, { ...a }), a.canEditBilling);
  const profile = profilePatch(a.review.person, read.client);

  const ex = read.contacts;
  const startSort = ex.reduce((m, x) => Math.max(m, (x.sort ?? 0) + 1), 0);
  const coordinator = coordinatorRow(a.review, {
    organizationId: a.organizationId, clientId: a.clientId, existing: ex, sort: startSort,
  });
  const contacts = [
    ...(coordinator ? [coordinator] : []),
    ...contactRows(a.review, {
      organizationId: a.organizationId, clientId: a.clientId,
      existingNames: ex.map((x) => x.name), startSort: startSort + (coordinator ? 1 : 0),
    }),
  ] as unknown as Record<string, unknown>[];

  return {
    plan: { ...dates, activated_on: plan.activatedOn ?? null, meeting_date: plan.meetingDate ?? null, status },
    goals, codes, codesHeld, clientPatch: profile.patch, profileFilled: profile.filled, contacts,
  };
}
