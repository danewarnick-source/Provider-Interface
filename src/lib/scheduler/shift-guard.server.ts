// The one server-side check every path that saves, publishes, claims or clocks
// into a shift runs: load the facts (rule-context.server.ts), run rules.ts at
// the agency's strengths, and turn the findings into refuse / ask for a reason
// / go ahead with warnings. Called by scheduler.functions.ts (save, publish),
// open-shifts.functions.ts (claim), repeat.functions.ts, drafts.functions.ts
// and clock-in.functions.ts. No caller adds checks of its own.
import { evaluateShifts, refusalLine, verdictOf, warningLines, type Verdict } from "./rules.ts";
import type { Finding } from "./rules-types.ts";
import { loadRuleContext, toRuleShift, type ShiftRowIn } from "./rule-context.server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type { ShiftRowIn } from "./rule-context.server.ts";

/** A refused action. The message is the finding's one plain line. */
export class ShiftRefusedError extends Error {
  verdict: Verdict;
  constructor(message: string, verdict: Verdict) {
    super(message);
    this.name = "ShiftRefusedError";
    this.verdict = verdict;
  }
}

export type ShiftCheck = { verdict: Verdict; findings: Finding[] };

/** Findings for proposed shift rows. Rows without an id get "new-<n>". */
export async function checkShiftRows(
  db: Db,
  orgId: string,
  rows: readonly ShiftRowIn[],
  opts: { reason?: string | null } = {},
): Promise<ShiftCheck> {
  const shifts = rows.map((r, i) => toRuleShift(r, `new-${i}`));
  if (!shifts.length) return { verdict: verdictOf([]), findings: [] };
  const ctx = await loadRuleContext(db, orgId, shifts);
  const findings = evaluateShifts(shifts, ctx);
  return { verdict: verdictOf(findings, opts.reason), findings };
}

/** Throws ShiftRefusedError on a block (or a missing reason); returns the warning lines. */
export async function guardShiftRows(
  db: Db,
  orgId: string,
  rows: readonly ShiftRowIn[],
  opts: { reason?: string | null } = {},
): Promise<string[]> {
  const { verdict } = await checkShiftRows(db, orgId, rows, opts);
  const refused = refusalLine(verdict);
  if (refused) throw new ShiftRefusedError(refused, verdict);
  return warningLines(verdict);
}

/** Refusal lines per shift id, for a batch that is all-or-nothing (publish). */
export function refusalsByShift(verdict: Verdict): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of [...verdict.blocks, ...verdict.needReason]) {
    if (!f.shiftId || out.has(f.shiftId)) continue;
    out.set(f.shiftId, f.level === "block" ? f.message : `Add a reason to go ahead: ${f.message}`);
  }
  return out;
}
