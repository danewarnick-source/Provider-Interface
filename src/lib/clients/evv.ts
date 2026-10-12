// Does EVV apply to this client? Only codes the SOW makes EVV-mandated
// (isEvvLockedCode in src/lib/evv-codes.ts) enforce the clock-in circle and
// need a home pin. Pure: shared by readiness, the list and the Profile.

import { isEvvLockedCode } from "../evv-codes.ts";

/** The client's active codes that need EVV, upper-cased, sorted, no repeats. */
export function clientEvvCodes(codes: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const c of codes) {
    const code = (c ?? "").trim().toUpperCase();
    if (isEvvLockedCode(code)) out.add(code);
  }
  return [...out].sort();
}

export type EvvAddressNote = { required: boolean; tag: string; text: string };

/** The tag and one line the service-address cards show. */
export function evvAddressNote(codes: readonly (string | null | undefined)[]): EvvAddressNote {
  const evv = clientEvvCodes(codes);
  if (!evv.length) {
    return {
      required: false,
      tag: "No EVV codes",
      text: "This client's services don't use EVV. The pin is optional; it's used for directions and as a record of where staff clocked in.",
    };
  }
  const list = evv.join(", ");
  return {
    required: true,
    tag: `EVV required: ${list}`,
    text: `Staff on ${list} must clock in inside the circle. These visits must meet the state's EVV rules.`,
  };
}
