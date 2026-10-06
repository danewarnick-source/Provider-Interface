/**
 * The one definition of "intake complete". Required = checklist items with no
 * `conditional` flag; satisfied = required items marked complete or waived.
 * The directory chip, the profile checklist card and the DB trigger that sets
 * clients.intake_status all follow this rule.
 */
export type IntakeProgress = { required: number; satisfied: number };

export type IntakeState = "none" | "not_started" | "partial" | "complete";

const SATISFIED = new Set(["complete", "waived"]);

export function summarizeIntake(
  requirements: Array<{ id: string; conditional: string | null }>,
  statusByRequirement: Map<string, string>,
): IntakeProgress {
  let required = 0;
  let satisfied = 0;
  for (const r of requirements) {
    if (r.conditional) continue;
    required += 1;
    if (SATISFIED.has(statusByRequirement.get(r.id) ?? "")) satisfied += 1;
  }
  return { required, satisfied };
}

export function intakeState(p: IntakeProgress | undefined): IntakeState {
  if (!p || p.required === 0) return "none";
  if (p.satisfied >= p.required) return "complete";
  return p.satisfied === 0 ? "not_started" : "partial";
}
