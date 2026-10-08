// Client contacts: the one place for every person tied to a client
// (guardian, emergency contacts, support coordinator, doctors, other providers).
// Pure helpers plus one loader that takes the caller's Supabase client.

import { todayYmd } from "./dates.ts";

export const CONTACT_ROLES = [
  "guardian",
  "representative",
  "emergency",
  "support_coordinator",
  "primary_doctor",
  "specialist",
  "prescriber",
  "dentist",
  "psychiatrist",
  "neurologist",
  "other_provider",
] as const;

export type ContactRole = (typeof CONTACT_ROLES)[number];

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  guardian: "Guardian",
  representative: "Representative",
  emergency: "Emergency contact",
  support_coordinator: "Support coordinator",
  primary_doctor: "Primary doctor",
  specialist: "Specialist",
  prescriber: "Prescriber",
  dentist: "Dentist",
  psychiatrist: "Psychiatrist",
  neurologist: "Neurologist",
  other_provider: "Other provider",
};

/** Roles that are medical providers (shown together on the face sheet and Health). */
export const PROVIDER_ROLES: readonly ContactRole[] = [
  "primary_doctor",
  "specialist",
  "prescriber",
  "dentist",
  "psychiatrist",
  "neurologist",
  "other_provider",
];

export const CLIENT_CONTACT_COLUMNS =
  "id, organization_id, client_id, role, name, relationship, phone, email, address, company, notes, is_primary, sort, ended_on, created_at";

export interface ClientContact {
  id: string;
  organization_id: string;
  client_id: string;
  role: ContactRole;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  company: string | null;
  notes: string | null;
  is_primary: boolean;
  sort: number;
  ended_on: string | null;
  created_at?: string;
}

/** The editable fields of a contact. */
export type ContactFields = Pick<
  ClientContact,
  "role" | "name" | "relationship" | "phone" | "email" | "address" | "company" | "notes" | "is_primary"
>;

export function isContactRole(v: unknown): v is ContactRole {
  return typeof v === "string" && (CONTACT_ROLES as readonly string[]).includes(v);
}


/** Contacts not ended on or before `now`. */
export function activeContacts<T extends Pick<ClientContact, "ended_on">>(
  contacts: readonly T[],
  now: Date = new Date(),
): T[] {
  const today = todayYmd(now);
  return contacts.filter((c) => !c.ended_on || c.ended_on > today);
}

type Sortable = Pick<ClientContact, "role" | "is_primary" | "sort" | "ended_on">;

/** Primary first, then by sort. */
function byPriority(a: Sortable, b: Sortable): number {
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
  return a.sort - b.sort;
}

/** Active contacts with this role, primary first. */
export function contactsWithRole<T extends Sortable>(
  contacts: readonly T[],
  role: ContactRole,
  now: Date = new Date(),
): T[] {
  return activeContacts(contacts, now)
    .filter((c) => c.role === role)
    .sort(byPriority);
}

/** The main active contact for a role (the primary one, else the first), or null. */
export function primaryContact<T extends Sortable>(
  contacts: readonly T[],
  role: ContactRole,
  now: Date = new Date(),
): T | null {
  return contactsWithRole(contacts, role, now)[0] ?? null;
}

export type ContactTone = "profile" | "info" | "ok" | "danger" | "neutral";

/** The one role tag on a contact card: a short label and a tone. */
export function contactTag(role: ContactRole): { label: string; tone: ContactTone } {
  if (role === "guardian" || role === "representative")
    return { label: CONTACT_ROLE_LABELS[role], tone: "profile" };
  if (role === "support_coordinator") return { label: "Support coordinator", tone: "info" };
  if (role === "emergency") return { label: "Emergency", tone: "danger" };
  if (role === "other_provider") return { label: "Other provider", tone: "neutral" };
  return {
    label: role === "primary_doctor" ? "Doctor" : CONTACT_ROLE_LABELS[role],
    tone: "ok",
  };
}

const CARD_RANK: Partial<Record<ContactRole, number>> = { guardian: 0, support_coordinator: 1 };

/**
 * The Contacts grid order: guardian first, then the support coordinator,
 * then everyone else by name (primary first within guardians/coordinators).
 */
export function contactCardOrder<T extends Sortable & Pick<ClientContact, "name">>(
  contacts: readonly T[],
): T[] {
  const rank = (c: T) => CARD_RANK[c.role] ?? 2;
  return [...contacts].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) < 2 ? byPriority(a, b) : 0) ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

/** Contacts ended on or before `now` (the "Past contacts" list), newest end first. */
export function pastContacts<T extends Pick<ClientContact, "ended_on">>(
  contacts: readonly T[],
  now: Date = new Date(),
): T[] {
  const today = todayYmd(now);
  return contacts
    .filter((c) => !!c.ended_on && c.ended_on <= today)
    .sort((a, b) => (b.ended_on ?? "").localeCompare(a.ended_on ?? ""));
}

/** Up to two initials for an avatar ("?" when the name is blank). */
export function contactInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** Group a mixed list (many clients) by client_id. */
export function contactsByClient<T extends Pick<ClientContact, "client_id">>(
  contacts: readonly T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const c of contacts) {
    const list = out.get(c.client_id) ?? [];
    list.push(c);
    out.set(c.client_id, list);
  }
  return out;
}

/** "Name (relationship) · phone" for one-line displays. */
export function contactLine(
  c: Pick<ClientContact, "name" | "relationship" | "phone"> | null | undefined,
): string {
  if (!c) return "";
  const who = c.relationship ? `${c.name} (${c.relationship})` : c.name;
  return c.phone ? `${who} · ${c.phone}` : who;
}

/**
 * A tel: link for the first number in a phone field, which may hold several
 * ("(801) 555-0100 (w) (801) 555-0101 (c)"). Null when there's no number.
 */
export function contactTelHref(phone: string | null | undefined): string | null {
  const first = (phone ?? "").match(/\+?\d[\d\s().-]{5,}\d/);
  return first ? `tel:${first[0].replace(/[^\d+]/g, "")}` : null;
}

/** Trimmed fields with blanks as null; throws when the name is empty. */
export function cleanContactFields(input: Partial<ContactFields> & { role: ContactRole }): ContactFields {
  const t = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    return s ? s : null;
  };
  const name = t(input.name);
  if (!name) throw new Error("A contact needs a name.");
  return {
    role: input.role,
    name,
    relationship: t(input.relationship),
    phone: t(input.phone),
    email: t(input.email),
    address: t(input.address),
    company: t(input.company),
    notes: t(input.notes),
    is_primary: !!input.is_primary,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContactsSupabase = { from: (table: string) => any };

/** All contacts (ended ones too) for some clients, oldest first within role/sort. */
export async function loadClientContacts(
  supabase: ContactsSupabase,
  clientIds: readonly string[],
): Promise<ClientContact[]> {
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from("client_contacts")
    .select(CLIENT_CONTACT_COLUMNS)
    .in("client_id", [...clientIds])
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientContact[];
}

export type ContactPartValues = Partial<Omit<ContactFields, "role" | "is_primary">>;

/**
 * Fill parts of the `slot`-th active contact for a role (0 = the main one),
 * adding it when there's none. Undefined parts are left alone; a blank part is
 * cleared, except the name (a contact always keeps one; a new contact with no
 * name is named after its role). Returns the contact id, or null when there
 * was nothing to write. Caller has already checked access.
 */
export async function setContactParts(
  supabase: ContactsSupabase,
  args: { organizationId: string; clientId: string; role: ContactRole; slot?: number; parts: ContactPartValues },
): Promise<string | null> {
  const { organizationId, clientId, role, slot = 0 } = args;
  const clean: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(args.parts)) {
    if (v === undefined) continue;
    const t = (v ?? "").trim();
    if (k === "name" && !t) continue;
    clean[k] = t || null;
  }
  const existing = contactsWithRole(await loadClientContacts(supabase, [clientId]), role)[slot];
  if (existing) {
    if (Object.keys(clean).length === 0) return existing.id;
    const { data, error } = await supabase.from("client_contacts").update(clean).eq("id", existing.id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error(`Updating the ${CONTACT_ROLE_LABELS[role].toLowerCase()} changed nothing.`);
    return existing.id;
  }
  if (!Object.values(clean).some(Boolean)) return null;
  const { data, error } = await supabase
    .from("client_contacts")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      role,
      name: CONTACT_ROLE_LABELS[role],
      ...clean,
      is_primary: slot === 0,
      sort: slot,
    })
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(`Adding the ${CONTACT_ROLE_LABELS[role].toLowerCase()} changed nothing.`);
  return (data[0] as { id: string }).id;
}
