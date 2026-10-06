/**
 * The roster search (view, filter, q, dropdowns, sort) the person last had,
 * so the profile's back buttons land on the same list. In memory only —
 * never localStorage: a reload starts from the plain roster.
 * The one-shot ?add / ?import dialog flags are never remembered.
 */
export type RosterReturnSearch = {
  view?: "active" | "invited" | "inactive";
  q?: string;
  filter?: string;
  home?: string;
  position?: string;
  supervisor?: string;
  sort?: string;
};

const KEYS = ["view", "q", "filter", "home", "position", "supervisor", "sort"] as const;

let last: RosterReturnSearch = {};

export function rememberRosterSearch(search: RosterReturnSearch & Record<string, unknown>): void {
  const next: RosterReturnSearch = {};
  for (const k of KEYS) {
    const v = search[k];
    if (typeof v === "string" && v !== "") (next as Record<string, string>)[k] = v;
  }
  last = next;
}

/** The remembered roster search, or {} (the plain roster). */
export function lastRosterSearch(): RosterReturnSearch {
  return { ...last };
}
