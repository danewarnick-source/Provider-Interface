// Staffing ratios: how many staff a group needs, and the default ratio for a
// code when none is entered. Pure. Ratio math becomes Needs-you reminders (S7);
// it never creates open shifts on its own (Decision 16).

/** Staff per clients: 1:6 is { staff: 1, clients: 6 }, 2:1 is { staff: 2, clients: 1 }. */
export type Ratio = { staff: number; clients: number };

export type DefaultRatio = Ratio & { assumed: true };

/** Weight of one client: the fraction of a staff member they need. */
export function weightOf(r: Ratio): number {
  return r.clients > 0 ? r.staff / r.clients : 0;
}

/**
 * Staff needed for the clients present: sum of each client's 1/ratio, rounded
 * up. Nine at 1:6, one at 1:3 and one at 1:1 is 1.5 + 0.33 + 1 = 2.83, so 3.
 */
export function staffNeeded(clientsPresent: ReadonlyArray<{ ratio: Ratio }>): number {
  const sum = clientsPresent.reduce((a, c) => a + weightOf(c.ratio), 0);
  // The small epsilon keeps 6 x (1/6) = 1.0000000000000002 from rounding up to 2.
  return Math.max(0, Math.ceil(sum - 1e-9)) || 0;
}

export function parseRatio(text: string | null | undefined): Ratio | null {
  const m = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(text ?? "");
  if (!m) return null;
  const r = { staff: Number(m[1]), clients: Number(m[2]) };
  return r.staff > 0 && r.clients > 0 ? r : null;
}

export function formatRatio(r: Ratio): string {
  return `${r.staff}:${r.clients}`;
}

export type RatioPlace = "facility" | "staff_home" | "client_home" | "community";

/** Work-group size for SED is 2 to 8 people (§28.2(1)). */
export function sedRatio(groupSize: number): Ratio {
  return { staff: 1, clients: Math.min(8, Math.max(2, Math.round(groupSize))) };
}

/**
 * Default ratio for a code when none is entered. Every default is marked
 * `assumed: true`. RHS/HHS/PPS have none ("not set"): returns null.
 */
export function defaultRatio(
  code: string,
  opts: { place?: RatioPlace; groupSize?: number } = {},
): DefaultRatio | null {
  const c = code.toUpperCase();
  switch (c) {
    case "DSG": case "DSP": case "EPR": case "RPS":
      return { staff: 1, clients: 6, assumed: true };
    case "RP2": case "RP3": case "RP4": case "RP5":
      return opts.place === "staff_home"
        ? { staff: 1, clients: 3, assumed: true }
        : { staff: 1, clients: 6, assumed: true };
    case "SED":
      return { ...sedRatio(opts.groupSize ?? 2), assumed: true };
    case "DSI": case "SLH": case "SLN": case "COM": case "PAC": case "SEI":
      return { staff: 1, clients: 1, assumed: true };
    default:
      return null;
  }
}

/** Codes where the group ratio is checked (a ratio that is not entered is assumed). */
export const RATIO_CODES: ReadonlySet<string> = new Set([
  "DSG", "DSP", "EPR", "RPS", "RP2", "RP3", "RP4", "RP5", "SED",
]);
