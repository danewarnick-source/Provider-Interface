// What confirming a reviewed PCSP writes, worked out without touching the
// database: authorization rows from OUR budget lines, other-provider
// contacts, and checks
// that must pass before anything is written.

import type { ReviewedPcsp } from "./review.ts";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Reasons the reviewed PCSP can't be confirmed yet (empty = OK). */
export function confirmProblems(r: ReviewedPcsp): string[] {
  const out: string[] = [];
  const { start, end } = r.plan;
  if (!start || !YMD.test(start) || !end || !YMD.test(end)) out.push("Enter the plan year's start and end dates.");
  else if (end < start) out.push("The plan year ends before it starts.");
  const goals = r.goals.filter((g) => g.include);
  if (!goals.length) out.push("Keep at least one goal.");
  if (goals.some((g) => !g.goal.trim())) out.push("Every kept goal needs its goal text.");
  const seen = new Set<string>();
  for (const b of r.budget.filter((x) => x.include)) {
    const code = b.code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,3}$/.test(code)) { out.push("Every kept budget line needs a service code (like DSI)."); continue; }
    if (seen.has(code)) out.push(`${code} is listed twice in the budget. Keep one line.`);
    seen.add(code);
    if (!(b.rate >= 0) || !Number.isFinite(b.rate)) out.push(`${code}: enter a rate.`);
    if (!Number.isInteger(b.annualUnits) || b.annualUnits < 0) out.push(`${code}: enter the yearly units.`);
    if ((b.start && !YMD.test(b.start)) || (b.end && !YMD.test(b.end))) out.push(`${code}: dates must be full dates.`);
  }
  return out;
}

export interface BillingCodeRow {
  organization_id: string;
  client_id: string;
  service_code: string;
  unit_type: string;
  rate_per_unit: number;
  annual_unit_authorization: number;
  monthly_max_units: number | null;
  service_start_date: string | null;
  service_end_date: string | null;
  rate_source: "pcsp";
  rate_source_document_id: string;
  rate_source_at: string;
  authorization_pending: false;
}

/** client_billing_codes rows (upserted on organization + client + code) from our kept budget lines. */
export function billingRows(
  r: ReviewedPcsp,
  a: { organizationId: string; clientId: string; documentId: string; now: string },
): BillingCodeRow[] {
  return r.budget.filter((b) => b.include).map((b) => ({
    organization_id: a.organizationId,
    client_id: a.clientId,
    service_code: b.code.trim().toUpperCase(),
    unit_type: b.unitType,
    rate_per_unit: b.rate,
    annual_unit_authorization: b.annualUnits,
    monthly_max_units: b.maxMonthlyUnits ?? null,
    service_start_date: b.start ?? r.plan.start,
    service_end_date: b.end ?? r.plan.end,
    rate_source: "pcsp",
    rate_source_document_id: a.documentId,
    rate_source_at: a.now,
    authorization_pending: false,
  }));
}

export interface ContactRow {
  organization_id: string; client_id: string; role: "other_provider"; name: string; company: string; notes: string; sort: number;
}

/** Other-provider contacts to add (skips names the client already has, open or ended). */
export function contactRows(
  r: ReviewedPcsp,
  a: { organizationId: string; clientId: string; existingNames: string[]; startSort: number },
): ContactRow[] {
  const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const have = new Set(a.existingNames.map(key));
  const out: ContactRow[] = [];
  for (const p of r.otherProviders) {
    if (!p.include || !p.provider.trim() || have.has(key(p.provider))) continue;
    have.add(key(p.provider));
    const note = ["From PCSP", p.code, p.note.trim()].filter(Boolean).join(" · ");
    out.push({
      organization_id: a.organizationId, client_id: a.clientId, role: "other_provider",
      name: p.provider.trim(), company: p.provider.trim(), notes: note, sort: a.startSort + out.length,
    });
  }
  return out;
}

/** carried_from_goal_id for a kept goal: continuing and changed goals carry history; new ones don't. */
export function carriedFrom(g: ReviewedPcsp["goals"][number], currentGoalIds: ReadonlySet<string>): string | null {
  if (g.carry.kind === "new" || !g.carry.fromGoalId) return null;
  return currentGoalIds.has(g.carry.fromGoalId) ? g.carry.fromGoalId : null;
}
