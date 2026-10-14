/**
 * The Clients list as the person last left it (view, search, code / home /
 * staff filters), so "← All clients" on a profile lands on the same list,
 * like browser Back. In memory only — never localStorage: a reload, or the
 * main menu's Clients link, starts from the plain list. Restored once, and
 * only after the profile's back link armed it.
 */
export type ClientListReturnView = "active" | "discharged" | "referrals";

export interface ClientListReturn {
  view: ClientListReturnView;
  search: string;
  code: string | null;
  homeId: string | null;
  staffId: string | null;
}

let last: ClientListReturn | null = null;
let armed = false;

export function rememberClientList(state: ClientListReturn): void {
  last = { ...state };
}

/** The list view to link back to ("active" when nothing is remembered). */
export function clientListReturnView(): ClientListReturnView {
  return last?.view ?? "active";
}

/** Called by the profile's back link: the next Clients list restores what was remembered. */
export function armClientListReturn(): void {
  armed = true;
}

/** The remembered list, once, if the back link armed it; otherwise null. */
export function takeClientListReturn(): ClientListReturn | null {
  if (!armed) return null;
  armed = false;
  return last ? { ...last } : null;
}
