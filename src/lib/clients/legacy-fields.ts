// The ONLY place the old flat client fields are named (besides the generated
// Supabase types). It maps them to client_contacts and the single-source
// columns — the same rules as the P3 backfill migrations
// (20261006100000_clients_contacts.sql, 20261006100100_clients_single_sources.sql).
// Smart import uses it too: the document extractor still emits these keys
// (stored import jobs hold them), and they land as contacts / single sources.
//
// PROMPT 12 DROP LIST — clients columns no code reads or writes after P3:
//   guardian_name, guardian_phone, guardian_relationship, guardian_email, guardian_address,
//   emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
//   emergency_contact_address, emergency_contact_instructions,
//   emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relationship,
//   emergency_contact_2_address, emergency_contact_2_instructions,
//   support_coordinator_name, support_coordinator_phone, support_coordinator_email,
//   support_coordinator_company, primary_care_name, primary_care_phone, pcp_name, pcp_phone,
//   prescriber_name, prescriber_phone, med_prescriber_name, med_prescriber_phone,
//   psychiatrist_name, psychiatrist_phone, psychiatrist_address, neurologist_name,
//   neurologist_phone, dentist_name, dentist_phone, dentist_address, specialist_name,
//   specialist_phone, physician_address, residential_provider, day_program_provider,
//   medical_insurance, private_insurance, medicare_number, preferred_activities,
//   preferred_living, clinical_alert, pertinent_health_notes, dietary_needs,
//   profile_photo_url, job_code, authorized_dspd_codes.
// Tables: client_emergency_contacts, client_external_services.
// Trigger: sync_client_authorized_codes_from_billing (no-op after the Phase B migration
//   20261006100300_clients_b_codes_copy_trigger_noop.sql).

import { CONTACT_ROLE_LABELS, type ContactFields, type ContactRole } from "./contacts.ts";

/** Extractor key for a staff must-know / safety notice (→ clients.special_directions). */
export const LEGACY_ALERT_KEY = "clinical_alert";

/** Extractor keys that now land in the single-source columns. */
export const LEGACY_SINGLE_SOURCE_KEYS = {
  /** → clients.insurance */
  insurance: "medical_insurance",
  /** → clients.about_me (with living) */
  activities: "preferred_activities",
  /** → clients.about_me (with activities) */
  living: "preferred_living",
} as const;

/** Old flat contact fields (clients columns, or the same keys from an import). */
export type LegacyContactSource = Partial<Record<string, string | null | undefined>>;

export interface LegacyEmergencyRow {
  name: string | null;
  phone: string | null;
  relationship: string | null;
  archived_at?: string | null;
}

export interface LegacyExternalService {
  provider_name: string | null;
  service_code: string | null;
  note: string | null;
}

export type BackfilledContact = ContactFields & { sort: number; ended_on: string | null };

type Slot = {
  role: ContactRole;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  relationship?: string;
  fixedRelationship?: string;
  company?: string;
  notes?: string;
  primary: boolean;
  sort: number;
};

// In priority order: when two slots give the same person, the first one wins.
const SLOTS: Slot[] = [
  { role: "guardian", name: "guardian_name", relationship: "guardian_relationship", phone: "guardian_phone", email: "guardian_email", address: "guardian_address", primary: true, sort: 0 },
  { role: "emergency", name: "emergency_contact_name", relationship: "emergency_contact_relationship", phone: "emergency_contact_phone", address: "emergency_contact_address", notes: "emergency_contact_instructions", primary: true, sort: 0 },
  { role: "emergency", name: "emergency_contact_2_name", relationship: "emergency_contact_2_relationship", phone: "emergency_contact_2_phone", address: "emergency_contact_2_address", notes: "emergency_contact_2_instructions", primary: false, sort: 1 },
  { role: "support_coordinator", name: "support_coordinator_name", phone: "support_coordinator_phone", email: "support_coordinator_email", company: "support_coordinator_company", primary: true, sort: 0 },
  { role: "primary_doctor", name: "primary_care_name", phone: "primary_care_phone", address: "physician_address", primary: true, sort: 0 },
  { role: "primary_doctor", name: "pcp_name", phone: "pcp_phone", address: "physician_address", primary: false, sort: 1 },
  { role: "prescriber", name: "prescriber_name", phone: "prescriber_phone", primary: true, sort: 0 },
  { role: "prescriber", name: "med_prescriber_name", phone: "med_prescriber_phone", primary: false, sort: 1 },
  { role: "psychiatrist", name: "psychiatrist_name", phone: "psychiatrist_phone", address: "psychiatrist_address", primary: true, sort: 0 },
  { role: "neurologist", name: "neurologist_name", phone: "neurologist_phone", primary: true, sort: 0 },
  { role: "dentist", name: "dentist_name", phone: "dentist_phone", address: "dentist_address", primary: true, sort: 0 },
  { role: "specialist", name: "specialist_name", phone: "specialist_phone", primary: true, sort: 0 },
  { role: "other_provider", name: "residential_provider", fixedRelationship: "Residential provider", primary: false, sort: 0 },
  { role: "other_provider", name: "day_program_provider", fixedRelationship: "Day program provider", primary: false, sort: 1 },
];

export type ContactPart = "name" | "phone" | "email" | "address" | "relationship" | "company" | "notes";

const PARTS: readonly ContactPart[] = ["name", "phone", "email", "address", "relationship", "company", "notes"];

/**
 * Old flat key (clients column / import field key) → the contact it fills:
 * role, part, and slot (0 = the main contact for the role, 1 = the second).
 */
export const LEGACY_CONTACT_KEYS: Readonly<Record<string, { role: ContactRole; part: ContactPart; slot: number }>> =
  (() => {
    const out: Record<string, { role: ContactRole; part: ContactPart; slot: number }> = {};
    const slotOf = new Map<ContactRole, number>();
    for (const s of SLOTS) {
      if (s.fixedRelationship) continue;
      const slot = slotOf.get(s.role) ?? 0;
      slotOf.set(s.role, slot + 1);
      for (const part of PARTS) {
        const key = s[part];
        if (key && !(key in out)) out[key] = { role: s.role, part, slot };
      }
    }
    return out;
  })();

/** The old flat key for a contact role + part + slot (throws when there is none). */
export function legacyContactKey(role: ContactRole, part: ContactPart, slot = 0): string {
  const hit = Object.entries(LEGACY_CONTACT_KEYS).find(
    ([, v]) => v.role === role && v.part === part && v.slot === slot,
  );
  if (!hit) throw new Error(`No legacy key for ${role}.${part}[${slot}]`);
  return hit[0];
}

function clean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const NAMELESS_LABEL: Record<ContactRole, string> = {
  ...CONTACT_ROLE_LABELS,
  other_provider: "Provider",
};

function dedupeKey(c: BackfilledContact): string {
  return `${c.role}|${c.name.toLowerCase()}|${(c.phone ?? "").replace(/\D/g, "")}`;
}

function build(
  role: ContactRole,
  raw: { name: unknown; phone?: unknown; email?: unknown; address?: unknown; relationship?: unknown; company?: unknown; notes?: unknown },
  primary: boolean,
  sort: number,
  endedOn: string | null,
): BackfilledContact | null {
  const phone = clean(raw.phone);
  const email = clean(raw.email);
  const name = clean(raw.name) ?? (phone || email ? NAMELESS_LABEL[role] : null);
  if (!name) return null;
  return {
    role,
    name,
    relationship: clean(raw.relationship),
    phone,
    email,
    address: clean(raw.address),
    company: clean(raw.company),
    notes: clean(raw.notes),
    is_primary: primary,
    sort,
    ended_on: endedOn,
  };
}

/**
 * Contacts for one client from the old columns, old emergency-contact rows and
 * old external services. Empty entries are skipped, a nameless entry with a
 * phone or email is named after its role, and the same role+name+phone appears once.
 */
export function legacyContactsForClient(
  client: LegacyContactSource,
  emergencyRows: readonly LegacyEmergencyRow[] = [],
  externalServices: readonly LegacyExternalService[] = [],
): BackfilledContact[] {
  const out: BackfilledContact[] = [];
  const seen = new Set<string>();
  const push = (c: BackfilledContact | null) => {
    if (!c) return;
    const key = dedupeKey(c);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  const g = (k: string | undefined) => (k ? client[k] : null);
  const [guardian, ec1, ec2, ...rest] = SLOTS;
  for (const s of [guardian, ec1, ec2]) {
    push(build(s.role, { name: g(s.name), phone: g(s.phone), email: g(s.email), address: g(s.address), relationship: g(s.relationship), notes: g(s.notes) }, s.primary, s.sort, null));
  }
  emergencyRows.forEach((e, i) =>
    push(build("emergency", e, false, 2 + i, e.archived_at ? e.archived_at.slice(0, 10) : null)),
  );
  for (const s of rest) {
    push(
      build(
        s.role,
        {
          name: g(s.name),
          phone: g(s.phone),
          email: g(s.email),
          address: g(s.address),
          relationship: s.fixedRelationship ?? g(s.relationship),
          company: g(s.company),
          notes: g(s.notes),
        },
        s.primary,
        s.sort,
        null,
      ),
    );
  }
  externalServices.forEach((x, i) => {
    const code = clean(x.service_code);
    push(
      build(
        "other_provider",
        { name: x.provider_name, relationship: code ? `Provides ${code.toUpperCase()}` : null, notes: x.note },
        false,
        2 + i,
        null,
      ),
    );
  });
  return out;
}

export interface LegacySingleSourceFields {
  insurance?: string | null;
  about_me?: string | null;
  special_directions?: string | null;
  client_photo_url?: string | null;
  medical_insurance?: string | null;
  private_insurance?: string | null;
  medicare_number?: string | null;
  preferred_activities?: string[] | null;
  preferred_living?: string | null;
  clinical_alert?: string | null;
  pertinent_health_notes?: string | null;
  dietary_needs?: string | null;
  profile_photo_url?: string | null;
}

function joinLines(parts: (string | null)[]): string | null {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join("\n") : null;
}

const labelled = (label: string, v: string | null) => (v ? `${label}${v}` : null);

/**
 * The single-source values for one client: insurance, about_me, special_directions
 * (staff must-knows) and client_photo_url. Existing values are kept; text is only
 * appended to special_directions when it isn't already there.
 */
export function singleSourcesFromLegacy(c: LegacySingleSourceFields): {
  insurance: string | null;
  about_me: string | null;
  special_directions: string | null;
  client_photo_url: string | null;
} {
  const insurance =
    clean(c.insurance) ??
    joinLines([
      clean(c.medical_insurance),
      labelled("Private: ", clean(c.private_insurance)),
      labelled("Medicare: ", clean(c.medicare_number)),
    ]);
  const activities = (c.preferred_activities ?? []).join(", ");
  const about_me =
    clean(c.about_me) ??
    joinLines([
      labelled("Enjoys: ", clean(activities)),
      labelled("Preferred living: ", clean(c.preferred_living)),
    ]);
  const current = c.special_directions ?? "";
  const alert = clean(c.clinical_alert);
  const notes = clean(c.pertinent_health_notes);
  const diet = clean(c.dietary_needs);
  const missing = (v: string | null) => (v && !current.includes(v) ? v : null);
  const special_directions = joinLines([
    clean(c.special_directions),
    missing(alert),
    notes !== alert ? missing(notes) : null,
    labelled("Diet: ", missing(diet)),
  ]);
  return {
    insurance,
    about_me,
    special_directions,
    client_photo_url: clean(c.client_photo_url) ?? clean(c.profile_photo_url),
  };
}
