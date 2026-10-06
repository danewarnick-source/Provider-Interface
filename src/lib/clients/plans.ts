// PCSP data in the shape DSPD uses: plan year → goals → supports → the codes
// paid to our agency. Pure helpers (no Supabase), importable by node --test.
// Rows come from client_plans / client_goals / client_goal_supports.

import { daysUntil, parseLocalDate, todayYmd } from "./dates.ts";

export const PLAN_STATUSES = ["upcoming", "current", "ended", "past"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export type PlanSource = "pcsp_upload" | "manual" | "migrated";

export interface ClientPlan {
  id: string;
  client_id: string;
  start_date: string | null;
  end_date: string | null;
  activated_on: string | null;
  meeting_date: string | null;
  status: PlanStatus;
  label: string | null;
  source: PlanSource;
  document_id: string | null;
  created_at?: string;
}

export interface OtherProvider {
  code: string;
  provider: string;
}

export interface GoalSupport {
  id: string;
  goal_id: string;
  support_text: string;
  details: string | null;
  start_date: string | null;
  end_date: string | null;
  our_codes: string[];
  other_providers: OtherProvider[];
  health_needs: string[];
  sort: number;
}

export interface ClientGoal {
  id: string;
  client_id: string;
  plan_id: string;
  carried_from_goal_id: string | null;
  goal_text: string;
  domain: string | null;
  current_status: string | null;
  strengths: string | null;
  barriers: string | null;
  success_person: string | null;
  success_team: string | null;
  sort: number;
  status: "active" | "ended";
  ended_on: string | null;
  supports: GoalSupport[];
}

/** A goal with only the supports that apply to one service code. */
export interface GoalWithSupports {
  goal: ClientGoal;
  supports: GoalSupport[];
}

/** Upper-cased, trimmed, distinct, non-empty codes. */
export function normalizeCodes(codes: readonly unknown[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of codes ?? []) {
    const c = String(raw ?? "").trim().toUpperCase();
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

function ymd(value: string | null | undefined): string | null {
  return parseLocalDate(value) ? String(value).slice(0, 10) : null;
}

/**
 * Status of one plan on a date (YYYY-MM-DD) from its dates: before start →
 * upcoming, inside → current, after end → ended. A plan replaced by a newer
 * one ('past') stays past; an undated plan keeps its stored status.
 */
export function planStatusOn(plan: Pick<ClientPlan, "start_date" | "end_date" | "status">, date: string): PlanStatus {
  if (plan.status === "past") return "past";
  const start = ymd(plan.start_date);
  const end = ymd(plan.end_date);
  if (!start && !end) return plan.status;
  if (start && date < start) return "upcoming";
  if (end && date > end) return "ended";
  return "current";
}

function startKey(p: ClientPlan): string {
  return ymd(p.start_date) ?? "0000-00-00";
}

/**
 * The plan in effect on a date: the latest plan that had started by then.
 * In the gap after a plan's end date (no newer plan yet) the ended plan
 * still governs, and `status` is 'ended' so callers can say "waiting".
 */
export function planInEffectOn(
  plans: readonly ClientPlan[],
  date: string,
): { plan: ClientPlan; status: PlanStatus } | null {
  const started = plans
    .filter((p) => {
      const s = ymd(p.start_date);
      return s ? s <= date : p.status !== "upcoming";
    })
    .sort((a, b) => startKey(b).localeCompare(startKey(a)) || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  // Dated plans sort first; with none, prefer the undated plan marked current.
  const plan = started.find((p) => ymd(p.start_date)) ?? started.find((p) => p.status === "current") ?? started[0];
  if (!plan) return null;
  const status = planStatusOn(plan, date);
  return { plan, status: status === "past" ? "ended" : status };
}

/** The client's current plan: the row marked current, else the plan in effect today. */
export function currentPlan(plans: readonly ClientPlan[], now: Date = new Date()): ClientPlan | null {
  return plans.find((p) => p.status === "current") ?? planInEffectOn(plans, todayYmd(now))?.plan ?? null;
}

/**
 * Days the client has been waiting for a new plan: days since the latest
 * plan's end date when it has ended and no newer plan has started. 0 when a
 * plan is in effect; null when there is no dated plan at all.
 */
export function waitingDays(plans: readonly ClientPlan[], now: Date = new Date()): number | null {
  const today = todayYmd(now);
  const effect = planInEffectOn(plans, today);
  if (!effect) return null;
  if (effect.status !== "ended") return ymd(effect.plan.end_date) || ymd(effect.plan.start_date) ? 0 : null;
  const until = daysUntil(effect.plan.end_date, now);
  return until === null ? null : Math.max(0, -until);
}

function supportOpenOn(s: GoalSupport, date: string | null): boolean {
  if (!date) return true;
  const start = ymd(s.start_date);
  const end = ymd(s.end_date);
  return (!start || start <= date) && (!end || end >= date);
}

/**
 * The supports a team member working `code` provides, grouped under their
 * goal: active goals only, supports whose our_codes include the code (and
 * that are open on `date` when given). Goals with no matching support drop out.
 */
export function supportsForCode(
  goals: readonly ClientGoal[],
  code: string | null | undefined,
  date: string | null = null,
): GoalWithSupports[] {
  const want = String(code ?? "").trim().toUpperCase();
  if (!want) return [];
  const out: GoalWithSupports[] = [];
  for (const goal of [...goals].sort((a, b) => a.sort - b.sort)) {
    if (goal.status !== "active") continue;
    const supports = goal.supports
      .filter((s) => normalizeCodes(s.our_codes).includes(want) && supportOpenOn(s, date))
      .sort((a, b) => a.sort - b.sort);
    if (supports.length) out.push({ goal, supports });
  }
  return out;
}

/** Every code any active goal's support lists (sorted). */
export function codesInGoals(goals: readonly ClientGoal[]): string[] {
  const all = goals
    .filter((g) => g.status === "active")
    .flatMap((g) => g.supports.flatMap((s) => normalizeCodes(s.our_codes)));
  return [...new Set(all)].sort();
}

/** One line for a goal and its supports, for prompts and plain-text lists. */
export function goalLine(g: GoalWithSupports): string {
  const supports = g.supports.map((s) => s.support_text.trim()).filter(Boolean);
  return supports.length ? `${g.goal.goal_text} — supports: ${supports.join("; ")}` : g.goal.goal_text;
}

/** Nests flat goal and support rows (as read from the tables) into ClientGoal[]. */
export function nestGoals(
  goalRows: ReadonlyArray<Omit<ClientGoal, "supports">>,
  supportRows: ReadonlyArray<Omit<GoalSupport, "our_codes" | "other_providers" | "health_needs"> & {
    our_codes: unknown;
    other_providers: unknown;
    health_needs: unknown;
  }>,
): ClientGoal[] {
  const byGoal = new Map<string, GoalSupport[]>();
  for (const s of supportRows) {
    const list = byGoal.get(s.goal_id) ?? [];
    list.push({
      ...s,
      support_text: s.support_text ?? "",
      our_codes: normalizeCodes(Array.isArray(s.our_codes) ? s.our_codes : []),
      health_needs: Array.isArray(s.health_needs) ? s.health_needs.map(String) : [],
      other_providers: Array.isArray(s.other_providers)
        ? (s.other_providers as Array<Partial<OtherProvider>>).map((p) => ({
            code: String(p?.code ?? "").toUpperCase(),
            provider: String(p?.provider ?? ""),
          }))
        : [],
    });
    byGoal.set(s.goal_id, list);
  }
  return [...goalRows]
    .sort((a, b) => a.sort - b.sort)
    .map((g) => ({ ...g, supports: (byGoal.get(g.id) ?? []).sort((a, b) => a.sort - b.sort) }));
}

/** All of one client's plans and their goals (every plan year). */
export interface ClientPlanBundle {
  plans: ClientPlan[];
  goals: ClientGoal[];
}

/**
 * The goals a note or summary dated `date` works from: those of the plan in
 * effect that day (the ended plan during a gap, with status 'ended').
 */
export function goalsOn(
  bundle: ClientPlanBundle | null | undefined,
  date: string,
): { plan: ClientPlan | null; status: PlanStatus | null; goals: ClientGoal[] } {
  const effect = bundle ? planInEffectOn(bundle.plans, date) : null;
  if (!bundle || !effect) return { plan: null, status: null, goals: [] };
  return { plan: effect.plan, status: effect.status, goals: bundle.goals.filter((g) => g.plan_id === effect.plan.id) };
}

/** One checkable support row on a note: "Goal — support", with its ids. */
export interface SupportOption {
  goalId: string;
  supportId: string;
  goal: string;
  support: string;
  label: string;
}

/** Flattens goal → supports groups into checkable rows, in order. */
export function goalSupportOptions(
  groups: ReadonlyArray<{ id: string; goal: string; supports: ReadonlyArray<{ id: string; support_text: string }> }>,
): SupportOption[] {
  return groups.flatMap((g) =>
    g.supports.map((s) => {
      const support = s.support_text.trim();
      return {
        goalId: g.id,
        supportId: s.id,
        goal: g.goal,
        support,
        label: support ? `${g.goal} — ${support}` : g.goal,
      };
    }),
  );
}

/** A goal and its supports as screens and prompts show them. */
export interface GoalView {
  id: string;
  goal: string;
  domain: string | null;
  supports: Array<{ id: string; support_text: string; details: string | null; our_codes: string[] }>;
}

export function goalView(goal: ClientGoal, supports: readonly GoalSupport[] = goal.supports): GoalView {
  return {
    id: goal.id,
    goal: goal.goal_text,
    domain: goal.domain,
    supports: supports.map((s) => ({ id: s.id, support_text: s.support_text, details: s.details, our_codes: s.our_codes })),
  };
}

/** Active goals of the plan in effect on `date`, as GoalViews (all supports). */
export function activeGoalViewsOn(bundle: ClientPlanBundle | null | undefined, date: string): GoalView[] {
  return goalsOn(bundle, date)
    .goals.filter((g) => g.status === "active")
    .sort((a, b) => a.sort - b.sort)
    .map((g) => goalView(g));
}

/**
 * Goals with the supports for any of `codes` (a team member may work more
 * than one code for a client), merged per goal, in plan order.
 */
export function supportsForCodes(
  goals: readonly ClientGoal[],
  codes: readonly string[],
  date: string | null = null,
): GoalWithSupports[] {
  const byGoal = new Map<string, GoalWithSupports>();
  for (const code of normalizeCodes(codes)) {
    for (const g of supportsForCode(goals, code, date)) {
      const hit = byGoal.get(g.goal.id);
      if (!hit) byGoal.set(g.goal.id, { goal: g.goal, supports: [...g.supports] });
      else for (const s of g.supports) if (!hit.supports.some((x) => x.id === s.id)) hit.supports.push(s);
    }
  }
  return [...byGoal.values()]
    .sort((a, b) => a.goal.sort - b.goal.sort)
    .map((g) => ({ ...g, supports: g.supports.sort((a, b) => a.sort - b.sort) }));
}
