// Team section: what Save writes for staff ↔ code assignments. Pure —
// importable by node --test.

function sameCodes(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c) => b.includes(c));
}

/** Each changed team member with the codes to save ([] removes them). */
export function assignmentChanges(
  original: ReadonlyMap<string, string[]>,
  next: ReadonlyMap<string, string[]>,
): { writes: Array<[string, string[]]>; dirty: boolean } {
  const writes: Array<[string, string[]]> = [];
  for (const [id, codes] of next) {
    const before = original.get(id);
    if (!before || !sameCodes(before, codes)) writes.push([id, codes]);
  }
  for (const id of original.keys()) if (!next.has(id)) writes.push([id, []]);
  return { writes, dirty: writes.length > 0 };
}

/** Team members checked with no codes picked — Save is blocked until fixed. */
export function staffMissingCodes(state: ReadonlyMap<string, string[]>): string[] {
  return [...state.entries()].filter(([, codes]) => codes.length === 0).map(([id]) => id);
}
