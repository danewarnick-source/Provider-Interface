// Profile details and the support coordinator a confirmed PCSP fills in.
// Only blank profile fields are filled (what a person typed is kept), and the
// support coordinator is added only when the client doesn't have them yet.
// Pure; confirm-write.ts does the writes.

import type { ReviewedPcsp } from "./review.ts";

export type ClientProfileRow = {
  client_pid: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  physical_address: string | null;
};

const FIELDS: { column: keyof ClientProfileRow; label: string; from: (p: ReviewedPcsp["person"]) => string | null }[] = [
  { column: "client_pid", label: "PID", from: (p) => p.pid },
  { column: "date_of_birth", label: "date of birth", from: (p) => p.dob },
  { column: "phone_number", label: "phone", from: (p) => p.phone },
  { column: "physical_address", label: "address", from: (p) => p.address },
];

/** clients columns to fill from the PCSP (blank ones only) and their labels for the result line. */
export function profilePatch(
  person: ReviewedPcsp["person"],
  current: Partial<ClientProfileRow>,
): { patch: Partial<ClientProfileRow>; filled: string[] } {
  const patch: Partial<ClientProfileRow> = {};
  const filled: string[] = [];
  for (const f of FIELDS) {
    const value = (f.from(person) ?? "").trim();
    if (!value || (current[f.column] ?? "").toString().trim()) continue;
    if (f.column === "date_of_birth" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    patch[f.column] = value;
    filled.push(f.label);
  }
  return { patch, filled };
}

export interface CoordinatorRow {
  organization_id: string;
  client_id: string;
  role: "support_coordinator";
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  notes: string;
  is_primary: boolean;
  sort: number;
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** The support coordinator contact to add, or null (left out, no name, or already a contact). */
export function coordinatorRow(
  r: ReviewedPcsp,
  a: {
    organizationId: string;
    clientId: string;
    existing: readonly { name: string; role: string | null }[];
    sort: number;
  },
): CoordinatorRow | null {
  const sc = r.person.supportCoordinator;
  if (!sc.include || !sc.name.trim()) return null;
  if (a.existing.some((c) => key(c.name) === key(sc.name))) return null;
  const v = (s: string) => s.trim() || null;
  return {
    organization_id: a.organizationId,
    client_id: a.clientId,
    role: "support_coordinator",
    name: sc.name.trim(),
    phone: v(sc.phone),
    email: v(sc.email),
    company: v(sc.company),
    notes: "From PCSP",
    is_primary: !a.existing.some((c) => c.role === "support_coordinator"),
    sort: a.sort,
  };
}
