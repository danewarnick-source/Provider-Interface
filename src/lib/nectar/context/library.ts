// The Knowledge base documents Nectar may answer from for this caller (N5,
// Decisions 2, 5 and 7). No runtime aliases, so node --test can import it.
//
// Only the current published version of a library document, never a draft
// or an archived one. Team members get only the documents meant for them
// (all team members, or they were checked), never the kinds the
// nectar_documents read policy hides from them (contracts, budgets, billing,
// timesheets, EVV reports). Agency-wide admins asking in the admin view get
// every published document, as they can open each one in the Knowledge base.

import type { NectarAskCaller, NectarDb } from "../engine/ask-types.ts";
import { isInAudience } from "../library/audience.ts";

export const TEAM_HIDDEN_DOCUMENT_TYPES: readonly string[] = [
  "contract",
  "1056_budget",
  "billing_record",
  "timesheet",
  "evv_report",
];
export const TEAM_HIDDEN_AUTHORITATIVE_KINDS: readonly string[] = ["provider_contract"];

export interface LibraryRow {
  id: string;
  title: string;
  version: number;
  library_group: string | null;
  library_status: string;
  superseded_by: string | null;
  archived_at: string | null;
  audience_all: boolean | null;
  policy_assigned_users: string[] | null;
  document_type: string | null;
  authoritative_kind: string | null;
}

export interface LibraryDoc {
  id: string;
  title: string;
  version: number;
  group: string;
}

const COLUMNS =
  "id, title, version, library_group, library_status, superseded_by, archived_at, audience_all, policy_assigned_users, document_type, authoritative_kind";

function hiddenFromTeam(row: LibraryRow): boolean {
  return (
    TEAM_HIDDEN_DOCUMENT_TYPES.includes(row.document_type ?? "") ||
    TEAM_HIDDEN_AUTHORITATIVE_KINDS.includes(row.authoritative_kind ?? "")
  );
}

/** The rows this caller may get answers from. Pure. */
export function libraryDocsFor(rows: readonly LibraryRow[], caller: NectarAskCaller): LibraryDoc[] {
  const wholeAgency = caller.view === "admin" && caller.agencyAdmin;
  return rows
    .filter(
      (r) =>
        r.library_status === "published" &&
        !r.superseded_by &&
        !r.archived_at &&
        !!r.library_group &&
        r.library_group !== "state",
    )
    .filter((r) => wholeAgency || (isInAudience(r, caller.userId) && !hiddenFromTeam(r)))
    .map((r) => ({ id: r.id, title: r.title, version: r.version, group: r.library_group! }));
}

export async function loadLibraryDocs(
  db: NectarDb,
  caller: NectarAskCaller,
): Promise<LibraryDoc[]> {
  const { data, error } = await db
    .from("nectar_documents")
    .select(COLUMNS)
    .eq("organization_id", caller.orgId)
    .eq("owner_kind", "company")
    .eq("library_status", "published")
    .is("superseded_by", null)
    .not("library_group", "is", null);
  if (error) throw new Error("Could not load your agency's documents.");
  return libraryDocsFor((data ?? []) as LibraryRow[], caller);
}
