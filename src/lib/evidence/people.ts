import { isEmployeeOnActiveRoster } from "../employee-roster.ts";
import { resolveHireDate } from "./due.ts";
import { staffInitials } from "./status.ts";
import type { EvidencePerson } from "./types.ts";

export type EvidenceClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string | null;
  authorized_dspd_codes?: string[] | null;
  job_code?: string[] | null;
};

/** Same active roster rule as the Clients page — only archived is hidden. */
export function isListedEvidenceClient(status: string | null | undefined): boolean {
  return (status ?? "active").toLowerCase() !== "archived";
}

export function mapClientRowsToPeople(rows: readonly EvidenceClientRow[]): EvidencePerson[] {
  return rows
    .filter((c) => isListedEvidenceClient(c.account_status))
    .map((c) => {
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client";
      const codes = c.authorized_dspd_codes ?? c.job_code ?? [];
      return {
        id: c.id,
        full_name: name,
        initials: staffInitials(name),
        subtitle: codes.length ? codes.join(", ") : null,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export type ClientPeopleQuery = (columns: string) => PromiseLike<{
  data: readonly EvidenceClientRow[] | null;
  error: { message: string } | null;
}>;

/** Full column select, then a slim retry so a missing optional column is not an empty roster. */
export async function loadEvidenceClientPeople(
  query: ClientPeopleQuery,
): Promise<{ people: EvidencePerson[]; error: string | null }> {
  const full = await query(
    "id, first_name, last_name, account_status, authorized_dspd_codes, job_code",
  );
  if (!full.error) {
    return { people: mapClientRowsToPeople(full.data ?? []), error: null };
  }
  const slim = await query("id, first_name, last_name, account_status");
  if (slim.error) {
    return { people: [], error: slim.error.message || full.error.message };
  }
  return { people: mapClientRowsToPeople(slim.data ?? []), error: null };
}

export type EvidenceEmployeeRow = {
  user_id: string;
  role: string | null;
  job_title: string | null;
  active: boolean;
  profile: {
    id?: string;
    full_name: string | null;
    first_name?: string | null;
    last_name?: string | null;
    account_status: string | null;
    is_active: boolean | null;
    hire_date?: string | null;
    start_date?: string | null;
  } | null;
};

/** Same active roster rule as the Employees page. */
export function mapEmployeeRowsToPeople(rows: readonly EvidenceEmployeeRow[]): EvidencePerson[] {
  return rows
    .filter((m) => isEmployeeOnActiveRoster(m))
    .map((m) => {
      const p = m.profile;
      const name =
        (p?.full_name ?? "").trim() ||
        `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() ||
        "Employee";
      return {
        id: m.user_id,
        full_name: name,
        initials: staffInitials(name),
        subtitle: (m.job_title ?? m.role ?? "").trim() || null,
        hire_date: resolveHireDate(p?.hire_date, p?.start_date),
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function companyEvidencePerson(organizationId: string, orgName: string): EvidencePerson {
  const name = orgName.trim() || "Company";
  return {
    id: organizationId,
    full_name: name,
    initials: staffInitials(name),
    subtitle: "Company file",
    hire_date: null,
  };
}

/** First and last name are both required to apply a pack. */
export function isAttestFullName(firstName: string, lastName: string): boolean {
  return firstName.trim().length >= 1 && lastName.trim().length >= 1;
}
