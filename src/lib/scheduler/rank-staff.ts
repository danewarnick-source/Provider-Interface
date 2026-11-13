// Who should take a shift, best fit first: the ranked list in Add shift › Who
// and Find staff on the scheduler board. Pure. find-staff.server.ts evaluates
// the proposed shift once per team member with the rule engine (rules.ts) and
// hands the findings here; this file adds no rules of its own. Order: no
// findings → warnings → reminders (Evidence items) → needs a reason → can't,
// then fewest hours this week, then name.
import { settingFor } from "./rules-strength.ts";
import type { Finding, RuleShift } from "./rules-types.ts";
import { hoursOf, isLive } from "./rules-util.ts";
import { dayKey, weekStartKey } from "./time.ts";

export type FitLevel = "ok" | "warn" | "reminder" | "reason" | "cant";

const ORDER: Record<FitLevel, number> = { ok: 0, warn: 1, reminder: 2, reason: 3, cant: 4 };

export const FIT_LABEL: Record<FitLevel, string> = {
  ok: "Good fit",
  warn: "Check",
  reminder: "Reminder",
  reason: "Needs a reason",
  cant: "Can't",
};

export type Candidate = {
  staffId: string;
  name: string;
  hoursThisWeek: number;
  findings: readonly Finding[];
};

export type RankedCandidate = Candidate & {
  level: FitLevel;
  /** The findings' one-line messages, worst first. */
  reasons: string[];
  /** The person's Evidence page when a card or training finding is the reason. */
  evidenceHref: string | null;
};

/** A warn-level finding from a state rule (cards, person-specific training). */
function isReminder(f: Finding): boolean {
  return f.level === "warn" && !!settingFor(f.rule)?.state;
}

export function fitLevel(findings: readonly Finding[]): FitLevel {
  if (findings.some((f) => f.level === "block")) return "cant";
  if (findings.some((f) => f.level === "reason")) return "reason";
  if (findings.some(isReminder)) return "reminder";
  return findings.length ? "warn" : "ok";
}

const SEVERITY: Record<Finding["level"], number> = { block: 0, reason: 1, warn: 2 };

function evidenceHref(findings: readonly Finding[]): string | null {
  return findings.find((f) => f.fix?.href?.startsWith("/dashboard/evidence"))?.fix?.href ?? null;
}

export function rankStaff(candidates: readonly Candidate[]): RankedCandidate[] {
  return candidates
    .map((c) => ({
      ...c,
      level: fitLevel(c.findings),
      reasons: [
        ...new Set(
          [...c.findings]
            .sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level])
            .map((f) => f.message),
        ),
      ],
      evidenceHref: evidenceHref(c.findings),
    }))
    .sort(
      (a, b) =>
        ORDER[a.level] - ORDER[b.level] ||
        a.hoursThisWeek - b.hoursThisWeek ||
        a.name.localeCompare(b.name),
    );
}

/** Qualified = may be offered an open shift: no block, no reason needed, no missing Evidence. */
export function isQualified(c: Pick<RankedCandidate, "level">): boolean {
  return c.level === "ok" || c.level === "warn";
}

/** Hours a team member has in the Sun–Sat week of `day`, leaving out one shift (the one being placed). */
export function weekHours(
  shifts: readonly RuleShift[],
  staffId: string,
  day: string,
  leaveOut?: string,
): number {
  const week = weekStartKey(day);
  const total = shifts
    .filter(
      (s) =>
        s.staffId === staffId &&
        s.id !== leaveOut &&
        isLive(s) &&
        weekStartKey(dayKey(s.startsAt)) === week,
    )
    .reduce((n, s) => n + hoursOf(s), 0);
  return Math.round(total * 100) / 100;
}
