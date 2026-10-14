// Where the two Nectar screens open (N6): their search params and the links
// other screens use. Pure: no Supabase, no aliases, so node --test can import it.
//
//   /dashboard/help                         admin Nectar, Ask tab
//   ?tab=questions | ?tab=settings          the Questions and AI settings tabs
//   ?q=<question>                           asks it once (the header search)
//
//   /dashboard/ask-nectar                   team member Nectar, Ask tab
//   ?tab=policies                           the Policies tab
//   ?doc=<nectar_documents id>              a policy, read-only, with Mark as reviewed
//   ?section=<knowledge_sections id>        a cited state rule section, read-only
//   ?q=<question>                           asks it once

const STAFF_NECTAR_PATH = "/dashboard/ask-nectar";

export const ADMIN_NECTAR_TABS = ["ask", "questions", "settings"] as const;
export type AdminNectarTab = (typeof ADMIN_NECTAR_TABS)[number];

const STAFF_NECTAR_TABS = ["ask", "policies"] as const;
export type StaffNectarTab = (typeof STAFF_NECTAR_TABS)[number];

export interface AdminNectarSearch {
  tab?: AdminNectarTab;
  q?: string;
}

export interface StaffNectarSearch {
  tab?: StaffNectarTab;
  doc?: string;
  section?: string;
  q?: string;
}

/** The longest question the header search can hand over. */
export const SEARCH_QUESTION_MAX = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const v = text(value);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function question(value: unknown): string | undefined {
  const q = typeof value === "string" ? value.trim() : "";
  return q ? q.slice(0, SEARCH_QUESTION_MAX) : undefined;
}

function uuid(value: unknown): string | undefined {
  const v = text(value);
  return v && UUID.test(v) ? v : undefined;
}

/** /dashboard/help's search params. Anything unknown is dropped; Ask is the default tab. */
export function parseAdminNectarSearch(raw: Record<string, unknown>): AdminNectarSearch {
  const out: AdminNectarSearch = {};
  const tab = pick(raw.tab, ADMIN_NECTAR_TABS);
  if (tab && tab !== "ask") out.tab = tab;
  const q = question(raw.q);
  if (q) out.q = q;
  return out;
}

/** /dashboard/ask-nectar's search params. Old ones (?clientId) are dropped. */
export function parseStaffNectarSearch(raw: Record<string, unknown>): StaffNectarSearch {
  const out: StaffNectarSearch = {};
  const tab = pick(raw.tab, STAFF_NECTAR_TABS);
  if (tab && tab !== "ask") out.tab = tab;
  const doc = uuid(raw.doc);
  if (doc) out.doc = doc;
  else {
    const section = uuid(raw.section);
    if (section) out.section = section;
  }
  const q = question(raw.q);
  if (q) out.q = q;
  return out;
}

function href(path: string, params: Array<[string, string | undefined]>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of params) if (value) qs.set(key, value);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** A link to team member Nectar: a tab, a policy or a state rule section. */
export function staffNectarHref(search: StaffNectarSearch = {}): string {
  return href(STAFF_NECTAR_PATH, [
    ["tab", search.tab && search.tab !== "ask" ? search.tab : undefined],
    ["doc", search.doc],
    ["section", search.doc ? undefined : search.section],
    ["q", search.q],
  ]);
}

/** What the team member screen shows for these search params. */
export type StaffNectarView =
  | { kind: "policy"; documentId: string; tab: StaffNectarTab }
  | { kind: "section"; sectionId: string; tab: StaffNectarTab }
  | { kind: "tab"; tab: StaffNectarTab };

export function staffNectarView(search: StaffNectarSearch): StaffNectarView {
  const tab = search.tab ?? "ask";
  if (search.doc) return { kind: "policy", documentId: search.doc, tab };
  if (search.section) return { kind: "section", sectionId: search.section, tab };
  return { kind: "tab", tab };
}
