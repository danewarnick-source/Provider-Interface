// Add client: the one-page form's shape, checks, and how it maps onto
// clients / client_billing_codes / client_contacts. Also "Start from their
// PCSP" (the reader's output → the form's fields, each filled field tagged).
// Pure; the writes live in create.functions.ts.

import { z } from "zod";
import { isDailyServiceCode } from "../service-billing.ts";
import type { PcspResult } from "./pcsp/parser-shared.ts";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max);

export const GEOFENCE_OPTIONS = [
  { feet: 250, label: "250 ft — in the home only" },
  { feet: 500, label: "500 ft — suburban" },
  { feet: 1000, label: "1,000 ft — standard" },
  { feet: 2500, label: "2,500 ft — community outings" },
  { feet: 5000, label: "5,000 ft — rural" },
] as const;

const codeLineSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((c) => c.toUpperCase()),
  /** True when the 1056 hasn't come back yet: the code is saved as pending, with no units. */
  waiting: z.boolean(),
  start: ymd.nullable(),
  end: ymd.nullable(),
  units: z.number().int().min(0).max(1_000_000).nullable(),
  rate: z.number().min(0).max(100_000).nullable(),
});
export type CodeLine = z.infer<typeof codeLineSchema>;

const personSchema = z.object({
  name: text(200),
  phone: text(50),
  email: text(200),
  relationship: text(100),
  company: text(200),
});
export type ContactPerson = z.infer<typeof personSchema>;

export const addClientFormSchema = z.object({
  first_name: text(100).min(1, "First name is required"),
  last_name: text(100).min(1, "Last name is required"),
  date_of_birth: ymd.nullable(),
  medicaid_id: text(50),
  client_pid: text(50),
  phone: text(50),
  address: text(255),
  /** When services start (saved as the clients start date). */
  start_date: ymd.nullable().default(null),
  support_coordinator: personSchema,
  is_own_guardian: z.boolean(),
  guardian: personSchema,
  codes: z.array(codeLineSchema).max(30),
  home_id: z.string().uuid().nullable(),
  geofence_radius_feet: z.number().int().min(50).max(10_000),
});
export type AddClientForm = z.infer<typeof addClientFormSchema>;

const EMPTY_PERSON: ContactPerson = {
  name: "",
  phone: "",
  email: "",
  relationship: "",
  company: "",
};

export function emptyAddClientForm(): AddClientForm {
  return {
    first_name: "",
    last_name: "",
    date_of_birth: null,
    medicaid_id: "",
    client_pid: "",
    phone: "",
    address: "",
    start_date: null,
    support_coordinator: { ...EMPTY_PERSON },
    is_own_guardian: true,
    guardian: { ...EMPTY_PERSON },
    codes: [],
    home_id: null,
    geofence_radius_feet: 1000,
  };
}

/** Medicaid IDs compare on letters and digits only ("12-345 678" = "12345678"). */
export function normalizeMedicaidId(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase();
}

/** The existing client with the same Medicaid ID, if any. */
export function findMedicaidDuplicate<T extends { id: string; medicaid_id: string | null }>(
  medicaidId: string,
  clients: readonly T[],
  exceptId?: string | null,
): T | null {
  const want = normalizeMedicaidId(medicaidId);
  if (!want) return null;
  return (
    clients.find((c) => c.id !== exceptId && normalizeMedicaidId(c.medicaid_id) === want) ?? null
  );
}

/** What still blocks saving, in plain words (empty = OK). */
export function formProblems(f: AddClientForm): string[] {
  const out: string[] = [];
  if (!f.first_name.trim()) out.push("first name");
  if (!f.last_name.trim()) out.push("last name");
  if (!f.medicaid_id.trim()) out.push("Medicaid ID");
  if (!f.address.trim()) out.push("service address");
  if (!f.is_own_guardian && (!f.guardian.name.trim() || !f.guardian.phone.trim()))
    out.push("guardian name and phone");
  const seen = new Set<string>();
  for (const c of f.codes) {
    const code = c.code.trim().toUpperCase();
    if (seen.has(code)) out.push(`${code} is listed twice`);
    seen.add(code);
    if (!c.waiting && (!c.start || !c.end))
      out.push(`${code} start and end dates (or mark it waiting on the 1056)`);
    if (c.start && c.end && c.end < c.start) out.push(`${code} ends before it starts`);
  }
  return out;
}

/** clients row values for a new client (home pin is geocoded on save). */
export function clientValues(f: AddClientForm): Record<string, unknown> {
  const blank = (v: string) => (v.trim() ? v.trim() : null);
  return {
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim(),
    date_of_birth: f.date_of_birth,
    medicaid_id: blank(f.medicaid_id),
    client_pid: blank(f.client_pid),
    phone_number: blank(f.phone),
    physical_address: blank(f.address),
    admission_date: f.start_date,
    team_id: f.home_id,
    geofence_radius_feet: f.geofence_radius_feet,
    is_own_guardian: f.is_own_guardian,
    intake_status: "in_progress",
    account_status: "active",
  };
}

/** client_billing_codes rows (authorizations) for the form's codes. */
export function authorizationRows(f: AddClientForm, organizationId: string, clientId: string) {
  return f.codes.map((c) => ({
    organization_id: organizationId,
    client_id: clientId,
    service_code: c.code.toUpperCase(),
    unit_type: isDailyServiceCode(c.code.toUpperCase()) ? "day" : "unit",
    service_start_date: c.start,
    service_end_date: c.end,
    annual_unit_authorization: c.waiting ? 0 : (c.units ?? 0),
    rate_per_unit: c.rate ?? 0,
    authorization_pending: c.waiting,
  }));
}

/** client_contacts rows: support coordinator and (when not their own) guardian. */
export function contactRows(f: AddClientForm) {
  const out: Array<{
    role: "support_coordinator" | "guardian";
    name: string;
    phone: string | null;
    email: string | null;
    relationship: string | null;
    company: string | null;
    is_primary: boolean;
  }> = [];
  const add = (role: "support_coordinator" | "guardian", p: ContactPerson) => {
    if (!p.name.trim()) return;
    const v = (s: string) => (s.trim() ? s.trim() : null);
    out.push({
      role,
      name: p.name.trim(),
      phone: v(p.phone),
      email: v(p.email),
      relationship: v(p.relationship),
      company: v(p.company),
      is_primary: true,
    });
  };
  add("support_coordinator", f.support_coordinator);
  if (!f.is_own_guardian) add("guardian", f.guardian);
  return out;
}

export type FilledField =
  | "name"
  | "client_pid"
  | "date_of_birth"
  | "phone"
  | "address"
  | "support_coordinator";

/**
 * Fill the form's first step from a PCSP read. Only empty fields are filled;
 * returns which ones were. Codes, units and the plan come from the PCSP
 * review (confirm-write.ts), not the form.
 */
export function prefillFromPcsp(
  f: AddClientForm,
  p: PcspResult,
): { form: AddClientForm; filled: FilledField[] } {
  const form: AddClientForm = { ...f, support_coordinator: { ...f.support_coordinator } };
  const filled: FilledField[] = [];
  const parts = p.person.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && !form.first_name && !form.last_name) {
    form.first_name = parts[0];
    form.last_name = parts[parts.length - 1];
    filled.push("name");
  }
  if (p.person.pid && !form.client_pid) {
    form.client_pid = p.person.pid;
    filled.push("client_pid");
  }
  if (p.person.dob && !form.date_of_birth) {
    form.date_of_birth = p.person.dob;
    filled.push("date_of_birth");
  }
  if (p.person.phone && !form.phone) {
    form.phone = p.person.phone;
    filled.push("phone");
  }
  if (p.person.residentialAddress && !form.address) {
    form.address = p.person.residentialAddress;
    filled.push("address");
  }
  const sc = p.person.supportCoordinator;
  if (sc.name && !form.support_coordinator.name) {
    form.support_coordinator = {
      name: sc.name,
      phone: sc.phone,
      email: sc.email,
      company: sc.company,
      relationship: "",
    };
    filled.push("support_coordinator");
  }
  return { form, filled };
}
