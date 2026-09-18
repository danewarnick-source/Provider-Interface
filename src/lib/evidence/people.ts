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

export function skipGetStartedKey(organizationId: string): string {
  return `evidence-get-started-skip:${organizationId}`;
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
