// Merging imported contacts (smart import, document updates) into a client's
// existing contacts without duplicating people or overwriting what an admin
// already entered. Pure — the caller does the writes.

import { CONTACT_ROLE_LABELS, type ClientContact } from "./contacts.ts";
import type { BackfilledContact } from "./legacy-fields.ts";

const PARTS = ["phone", "email", "address", "relationship", "company", "notes"] as const;
type Part = (typeof PARTS)[number];

export interface ContactMergePlan {
  inserts: BackfilledContact[];
  fills: Array<{ id: string; patch: Partial<Record<Part, string>> }>;
  /** A different value is already on file — flag for admin review, never overwrite. */
  conflicts: Array<{ field: string; existing: string; incoming: string }>;
}

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function samePart(part: Part, a: string, b: string): boolean {
  return part === "phone" ? digits(a) === digits(b) : norm(a) === norm(b);
}

/** True when the import only knew the role (the name is the role's placeholder label). */
function isPlaceholderName(c: BackfilledContact): boolean {
  return norm(c.name) === norm(CONTACT_ROLE_LABELS[c.role]) || norm(c.name) === "provider";
}

function findMatch(existing: readonly ClientContact[], c: BackfilledContact): ClientContact | undefined {
  const sameRole = existing.filter((e) => e.role === c.role);
  if (isPlaceholderName(c)) return sameRole.find((e) => e.is_primary) ?? sameRole[0];
  return sameRole.find(
    (e) => norm(e.name) === norm(c.name) || (!!digits(c.phone) && digits(e.phone) === digits(c.phone)),
  );
}

export function planContactMerge(
  existing: readonly ClientContact[],
  incoming: readonly BackfilledContact[],
): ContactMergePlan {
  const plan: ContactMergePlan = { inserts: [], fills: [], conflicts: [] };
  const rolesWithContacts = new Set(existing.map((e) => e.role));
  for (const c of incoming) {
    const match = findMatch(existing, c);
    if (!match) {
      const firstOfRole = !rolesWithContacts.has(c.role);
      plan.inserts.push({ ...c, is_primary: c.is_primary && firstOfRole });
      rolesWithContacts.add(c.role);
      continue;
    }
    const patch: Partial<Record<Part, string>> = {};
    for (const part of PARTS) {
      const next = c[part];
      if (!next) continue;
      const cur = match[part];
      if (!cur) patch[part] = next;
      else if (!samePart(part, cur, next)) {
        plan.conflicts.push({ field: `contact:${c.role}.${part}`, existing: cur, incoming: next });
      }
    }
    if (Object.keys(patch).length) plan.fills.push({ id: match.id, patch });
  }
  return plan;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MergeSupabase = { from: (table: string) => any };

/** Write a merge plan (inserts + fills). Returns how many contacts changed. */
export async function applyContactMergePlan(
  supabase: MergeSupabase,
  organizationId: string,
  clientId: string,
  plan: ContactMergePlan,
): Promise<number> {
  if (plan.inserts.length) {
    const rows = plan.inserts.map((c) => ({ ...c, organization_id: organizationId, client_id: clientId }));
    const { error } = await supabase.from("client_contacts").insert(rows);
    if (error) throw new Error(error.message);
  }
  for (const f of plan.fills) {
    const { error } = await supabase.from("client_contacts").update(f.patch).eq("id", f.id);
    if (error) throw new Error(error.message);
  }
  return plan.inserts.length + plan.fills.length;
}
