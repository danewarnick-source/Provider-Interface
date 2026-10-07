// The review step between reading a PCSP and confirming it. `initialReview`
// turns the parse + carry-over proposal into the editable shape the review
// screen shows and `confirmPcsp` receives. Pure; no database.

import { isDailyServiceCode } from "../../service-billing.ts";
import type { CarryKind, CarryOver } from "./carry-over.ts";
import type { HealthNeed, Issue, PcspResult, Provider, Risk } from "./parser-shared.ts";

export type ReviewSupport = {
  support: string; details: string; start: string | null; end: string | null;
  ourCodes: string[]; providers: Provider[]; healthNeeds: HealthNeed[];
};
export type ReviewGoal = {
  include: boolean;
  goal: string; domain: string; currentStatus: string; strengths: string; barriers: string;
  successPerson: string; successTeam: string; page: number;
  carry: { kind: CarryKind; fromGoalId: string | null; fromGoalText: string | null };
  supports: ReviewSupport[];
};
export type ReviewBudgetLine = {
  include: boolean; code: string; unitType: string; start: string | null; end: string | null;
  rate: number; maxMonthlyUnits: number | null; annualUnits: number;
};
export type ReviewOtherProvider = { include: boolean; code: string; provider: string; note: string };

export type ReviewedPcsp = {
  plan: { start: string | null; end: string | null; activatedOn: string | null; meetingDate: string | null };
  goals: ReviewGoal[];
  budget: ReviewBudgetLine[];
  risks: (Risk & { include: boolean })[];
  otherProviders: ReviewOtherProvider[];
};

/** Stored client_billing_codes.unit_type ("Q" | "day" | "hourly") from the PCSP's unit text. */
export function unitTypeFor(code: string, pcspUnit: string | null | undefined): string {
  const u = (pcspUnit ?? "").toLowerCase();
  if (/15|quarter/.test(u)) return "Q";
  if (/da(y|ily)/.test(u)) return "day";
  if (/hour/.test(u)) return "hourly";
  return isDailyServiceCode(code) ? "day" : "Q";
}

const RISK_KINDS = /risk|behavio|nurs|medic|health/i;
/** Behavior and nursing service codes (FEATURE_CODES behavior + med monitoring). */
const RISK_CODES = new Set(["BC1", "BC2", "BC3", "PM1", "PM2", "PN1", "PN2"]);

/**
 * Other agencies' risk / behavior / nursing providers become "other provider"
 * contacts: budget lines that aren't ours with a behavior or nursing code, or
 * whose code or provider is named in a risk/behavior/nursing non-goal support.
 */
export function otherProvidersFrom(parse: PcspResult): ReviewOtherProvider[] {
  const riskSupports = parse.nonGoalSupports.filter((s) => RISK_KINDS.test(`${s.support} ${s.details}`));
  const out: ReviewOtherProvider[] = [];
  for (const b of parse.budget) {
    if (b.ours || !b.provider) continue;
    const firstWord = b.provider.split(/\s+/)[0]?.toLowerCase() ?? "";
    const named = riskSupports.find((s) => {
      const hay = `${s.support} ${s.details}`.toLowerCase();
      return hay.includes(b.code.toLowerCase()) || (firstWord.length > 2 && hay.includes(firstWord));
    });
    if (!named && !RISK_CODES.has(b.code)) continue;
    if (out.some((o) => o.code === b.code && o.provider === b.provider)) continue;
    out.push({ include: true, code: b.code, provider: b.provider, note: named ? named.support : "" });
  }
  return out;
}

export function initialReview(parse: PcspResult, carry: CarryOver): ReviewedPcsp {
  const unitFor = (code: string) => parse.purchasedServices.find((p) => p.code === code)?.unitType;
  return {
    plan: { start: parse.plan.start, end: parse.plan.end, activatedOn: parse.plan.activatedOn, meetingDate: parse.plan.meetingDate },
    goals: parse.goals.map((g, i) => {
      const c = carry.goals.find((x) => x.index === i);
      return {
        include: true,
        goal: g.goal, domain: g.domain, currentStatus: g.currentStatus, strengths: g.strengths, barriers: g.barriers,
        successPerson: g.successPerson, successTeam: g.successTeam, page: g.page,
        carry: { kind: c?.kind ?? "new", fromGoalId: c?.fromGoalId ?? null, fromGoalText: c?.fromGoalText ?? null },
        supports: g.supports.map((s) => ({
          support: s.support, details: s.details, start: s.start, end: s.end,
          ourCodes: [...s.ourCodes], providers: s.providers.map((p) => ({ ...p })), healthNeeds: s.healthNeeds.map((h) => ({ ...h })),
        })),
      };
    }),
    budget: parse.budget.filter((b) => b.ours).map((b) => ({
      include: true, code: b.code, unitType: unitTypeFor(b.code, unitFor(b.code)), start: b.start, end: b.end,
      rate: b.rate, maxMonthlyUnits: b.maxMonthlyUnits, annualUnits: b.annualUnits,
    })),
    risks: parse.risks.map((r) => ({ ...r, include: true })),
    otherProviders: otherProvidersFrom(parse),
  };
}

export interface ReviewSummary {
  goals: number;
  supports: number;
  supportsForUs: number;
  continuing: number;
  changed: number;
  newGoals: number;
  budgetTotalForUs: number;
}

export function reviewSummary(parse: PcspResult, review: ReviewedPcsp): ReviewSummary {
  const goals = review.goals.filter((g) => g.include);
  const supports = goals.flatMap((g) => g.supports);
  const kinds = (k: CarryKind) => goals.filter((g) => g.carry.kind === k).length;
  return {
    goals: goals.length,
    supports: supports.length,
    supportsForUs: supports.filter((s) => s.ourCodes.length > 0).length,
    continuing: kinds("continuing"),
    changed: kinds("changed"),
    newGoals: kinds("new"),
    budgetTotalForUs: parse.budget.filter((b) => b.ours).reduce((sum, b) => sum + b.total, 0),
  };
}

const LEVEL_ORDER: Record<Issue["level"], number> = { error: 0, warn: 1, info: 2 };

/** "Things to check": errors first, then by page (unpaged last). */
export function thingsToCheck(issues: readonly Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (a.page ?? 999) - (b.page ?? 999),
  );
}
