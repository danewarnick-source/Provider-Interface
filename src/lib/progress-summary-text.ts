// The text of a progress summary with goal progress, as the editor saves and
// finalizes it: the header lines, the general summary, then each goal with
// its progress. Pure, importable by node --test.

export function summaryText(a: {
  clientName: string;
  provider: string;
  supportCoordinator: string;
  summary: { service_codes: string[]; period_start: string; period_end: string };
  general: string;
  goalDrafts: Record<string, string>;
  goals: readonly { id: string; goal: string }[];
}): string {
  return [
    `PERSON: ${a.clientName}`,
    `SERVICES PROVIDED THIS PERIOD: ${a.summary.service_codes.join(", ") || "(none)"}`,
    `DATE RANGE: ${a.summary.period_start} to ${a.summary.period_end}`,
    `PROVIDER: ${a.provider}`,
    `SUPPORT COORDINATOR: ${a.supportCoordinator}`,
    "",
    "GENERAL SUMMARY",
    a.general.trim() || "(write general summary)",
    "",
    "GOAL PROGRESS",
    ...a.goals.flatMap((g) => [
      `Goal: ${g.goal}`,
      (a.goalDrafts[g.id] ?? "").trim() ||
        "No documentation in this period supports progress on this goal.",
      "",
    ]),
  ].join("\n");
}
