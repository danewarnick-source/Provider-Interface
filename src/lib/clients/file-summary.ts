// The Service summary card of the Client file: on file when every owed
// summary is finalized (and entered in UPI where required), otherwise due
// on the oldest overdue one. Cadences come from progress-summaries.ts.

import {
  bucketCodes,
  isPeriodInProgress,
  recentMonthlyPeriods,
  recentQuarterlyPeriods,
} from "../progress-summaries.ts";
import type { ClientFileFacts } from "./file.ts";

function latestClosedOwedDue(codes: string[], now: Date): string | null {
  const buckets = bucketCodes(codes);
  const owed: string[] = [];
  if (buckets.quarterly.size) {
    for (const p of recentQuarterlyPeriods(now, 1)) {
      if (!isPeriodInProgress(p.period_end, now)) owed.push(p.due_date);
    }
  }
  if (buckets.monthlyNarrative.size || buckets.monthlyFinancial.size) {
    for (const p of recentMonthlyPeriods(now, 1)) {
      if (!isPeriodInProgress(p.period_end, now)) owed.push(p.due_date);
    }
  }
  owed.sort((a, b) => b.localeCompare(a));
  return owed[0] ?? null;
}

export function summaryCard(facts: Pick<ClientFileFacts, "codes" | "summaries">, now: Date): { onFile: boolean; dueAt: string | null } {
  const owedDue = latestClosedOwedDue(facts.codes, now);
  const latest = facts.summaries[0] ?? null;
  if (!latest && !owedDue) return { onFile: false, dueAt: null };
  if (!latest) return { onFile: false, dueAt: owedDue };

  const overdue = facts.summaries.filter((s) => {
    const due = s.due_date.slice(0, 10);
    const finalized = s.status === "finalized" || !!s.finalized_at;
    const upiGap = s.requires_upi_attestation && finalized && !s.upi_entered_at && due < now.toISOString().slice(0, 10);
    return (due < now.toISOString().slice(0, 10) && !finalized) || upiGap;
  });
  const latestFinal = latest.status === "finalized" || !!latest.finalized_at;
  const latestUpiOk = !latest.requires_upi_attestation || !!latest.upi_entered_at;
  const onFile = overdue.length === 0 && latestFinal && latestUpiOk;
  if (onFile) return { onFile: true, dueAt: null };
  return { onFile: false, dueAt: overdue[0]?.due_date ?? latest.due_date ?? owedDue };
}
