// Team section: the team member cards (who works with the client, on which
// codes, and whether they're ready to work alone). Saves go one team member
// at a time through setStaffClientCodes ([] takes them off the team). Pure —
// importable by node --test.

export type TeamCard = {
  id: string;
  name: string;
  codes: string[];
  readiness: { label: string; tone: "ok" | "danger" | "neutral"; detail: string | null };
};

type Readiness = { id: string; readyAlone: boolean; readinessLabel: string };

const UNKNOWN = "Readiness not available";

/** "Ready alone" / "Training needed" (detail = what's missing), or unknown. */
export function readinessTag(r: Readiness | undefined): TeamCard["readiness"] {
  if (!r || r.readinessLabel === UNKNOWN)
    return { label: "Readiness unknown", tone: "neutral", detail: null };
  if (r.readyAlone) return { label: "Ready alone", tone: "ok", detail: r.readinessLabel };
  return { label: "Training needed", tone: "danger", detail: r.readinessLabel };
}

/** One card per assigned team member, by name; the client's code order kept. */
export function teamCards(
  assigned: ReadonlyMap<string, readonly string[]>,
  names: ReadonlyMap<string, string>,
  readiness: readonly Readiness[],
  clientCodes: readonly string[],
): TeamCard[] {
  const ready = new Map(readiness.map((r) => [r.id, r]));
  const order = (codes: readonly string[]) => [
    ...clientCodes.filter((c) => codes.includes(c)),
    ...codes.filter((c) => !clientCodes.includes(c)),
  ];
  return [...assigned.entries()]
    .map(([id, codes]) => ({
      id,
      name: names.get(id) ?? "Team member",
      codes: order(codes),
      readiness: readinessTag(ready.get(id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
