// Maps the old plan fields to client_plans / client_goals / client_goal_supports
// — the same rules as the P4 backfill (20261006134832_clients_plans_goals.sql).
// Besides legacy-fields.ts, the only place these old fields are named.
//
// PROMPT 12 DROP LIST — after P4 nothing in src/ reads or writes these:
//   clients.pcsp_goals, client_specific_trainings.goals.
// Still read/written until the Plans section replaces them (Prompt 8):
//   clients.plan_year, clients.pcsp_expiration_date, clients.pcsp_signed_date.
// Kept: daily_logs.pcsp_goals_addressed / evv_timesheets.goals_completed are the
//   note's own text record of what was worked on (goal_ids/support_ids sit beside them).

import { normalizeCodes, type PlanStatus } from "./plans.ts";
import { parseLocalDate } from "./dates.ts";

export interface LegacyPlanFields {
  plan_year: string | null;
  pcsp_expiration_date: string | null;
}

export interface MigratedPlan {
  start_date: string | null;
  end_date: string | null;
  status: Exclude<PlanStatus, "past">;
  label: string | null;
}

const RANGE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;
const p2 = (n: string | number) => String(n).padStart(2, "0");

function mdy(m: string, d: string, y: string): string | null {
  const v = `${y}-${p2(m)}-${p2(d)}`;
  return parseLocalDate(v) ? v : null;
}

/** "end date minus one year plus one day" for a plan known only by its end. */
function yearBefore(end: string): string | null {
  const d = parseLocalDate(end);
  if (!d) return null;
  const start = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate() + 1);
  return `${start.getFullYear()}-${p2(start.getMonth() + 1)}-${p2(start.getDate())}`;
}

/**
 * The one migrated plan for a client. Dates come from a "MM/DD/YYYY - MM/DD/YYYY"
 * plan_year, else from pcsp_expiration_date (start = a year before). A bare
 * "2025-2026" label gives no days, so the plan stays undated (label kept).
 */
export function legacyPlanForClient(c: LegacyPlanFields, today: string): MigratedPlan {
  const label = c.plan_year?.trim() || null;
  const m = label ? RANGE.exec(label) : null;
  let start_date: string | null = null;
  let end_date: string | null = null;
  if (m) {
    start_date = mdy(m[1], m[2], m[3]);
    end_date = mdy(m[4], m[5], m[6]);
  } else if (parseLocalDate(c.pcsp_expiration_date)) {
    end_date = String(c.pcsp_expiration_date).slice(0, 10);
    start_date = yearBefore(end_date);
  }
  const status =
    start_date && start_date > today ? "upcoming" : end_date && end_date < today ? "ended" : "current";
  return { start_date, end_date, status, label };
}

export interface MigratedGoal {
  goal_text: string;
  sort: number;
  support: { support_text: string; details: string | null; our_codes: string[] };
}

const text = (v: unknown) => String(v ?? "").trim();

/**
 * Goals for the migrated plan: the training record's goal JSON when it has any
 * (each goal → one support with its job_codes), else the flat pcsp_goals list.
 * A goal with no codes gets the client's active codes.
 */
export function legacyGoalsForClient(
  trainingGoals: unknown,
  flatGoals: unknown,
  activeCodes: readonly string[],
): MigratedGoal[] {
  const fallback = normalizeCodes(activeCodes).sort();
  const rich = Array.isArray(trainingGoals) && trainingGoals.length > 0 ? trainingGoals : null;
  const out: MigratedGoal[] = [];
  if (rich) {
    rich.forEach((g, i) => {
      if (!g || typeof g !== "object") return;
      const o = g as Record<string, unknown>;
      const goal_text = text(o.goal);
      if (!goal_text) return;
      const codes = normalizeCodes(Array.isArray(o.job_codes) ? o.job_codes : []).sort();
      out.push({
        goal_text,
        sort: i,
        support: {
          support_text: text(o.supports),
          details: text(o.details) || null,
          our_codes: codes.length ? codes : fallback,
        },
      });
    });
    return out;
  }
  (Array.isArray(flatGoals) ? flatGoals : []).forEach((g, i) => {
    const goal_text = text(g);
    if (goal_text) out.push({ goal_text, sort: i, support: { support_text: "", details: null, our_codes: fallback } });
  });
  return out;
}
