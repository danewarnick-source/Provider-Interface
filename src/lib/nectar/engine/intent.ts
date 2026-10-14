// What kind of question a team member asked (N5). Pure: no imports, so
// node --test can import it.
//
// Pay and hours questions get the fixed refusal before any model call
// (Decision 7). Schedule questions load the caller's own published shifts
// (context/shifts.ts); nothing else does.

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Pay, earnings, rates or hours worked: Nectar refuses these for team members. */
export function questionWantsPayOrHours(question: string): boolean {
  const q = question.trim();
  if (!q) return false;

  if (
    /\b(paycheck|pay\s*check|payroll|wages?|salary|salaries|earnings?|gross pay|overtime pay|ot pay)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  if (
    /\b(my pay|what(?:'s| is) my pay|estimated (?:pay|earnings)|how much did i make)\b/i.test(q)
  ) {
    return true;
  }
  if (/\bhow much\b[\s\S]{0,40}\b(make|earn|get paid|paid|pay|dollars?|money)\b/i.test(q)) {
    return true;
  }
  if (/\b(hourly rate|pay rate|what(?:'s| is) my rate)\b/i.test(q)) {
    return true;
  }
  if (/\$\s*\d/.test(q) && /\b(pay|earn|make|hour|wage|rate)\b/i.test(q)) {
    return true;
  }
  if (/\bhow much\b[\s\S]{0,40}\breimburs/i.test(q)) {
    return true;
  }
  if (/\b(reimbursement|mileage)\s+(amount|total|pay|dollars?)\b/i.test(q)) {
    return true;
  }

  if (/\bhow many\s+shifts?\b/i.test(q)) return false;
  if (/\b(how many|how much)\s+hours\b/i.test(q)) return true;
  if (/\bhours\s+(did|have|i(?:'|’)?ve)\s+i\s+work/i.test(q)) return true;
  if (/\bhours\s+(this|last|the)\s+(week|month|period|pay\s*period)\b/i.test(q)) return true;
  if (/\b(hours worked|hours this (?:pay )?period|clocked hours|time worked)\b/i.test(q)) {
    return true;
  }
  if (/\b(did i|have i|i(?:'|’)?ve)\s+work(?:ed)?\b[\s\S]{0,24}\bhours\b/i.test(q)) {
    return true;
  }
  return false;
}

/** The caller's own schedule: when they work, with whom, how many shifts. Never pay or hours. */
export function questionWantsSchedule(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  if (questionWantsPayOrHours(q)) return false;

  if (
    /\b(my schedule|upcoming (?:shifts?|schedule)|when do i work|am i (?:working|scheduled)|do i work)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  if (/\bwhen(?:'s| is) (?:my |the )?(?:next )?(?:shift|work)\b/i.test(q)) {
    return true;
  }
  if (/\bnext time i work\b/i.test(q)) return true;
  if (/\bwork with\b/i.test(q)) return true;
  if (/\b(how many|count|number of)\s+shifts?\b/i.test(q)) return true;
  if (/\b(schedule|scheduled|shifts?)\b/i.test(q)) return true;
  if (
    new RegExp(`\\b(?:this |next )?(?:${WEEKDAYS.join("|")})\\b`, "i").test(q) &&
    /\b(work|shift|schedule|on)\b/i.test(q)
  ) {
    return true;
  }
  return false;
}
