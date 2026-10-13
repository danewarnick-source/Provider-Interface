// The Knowledge base library model (N3, Decisions 1, 2 and 6). Pure: no
// Supabase, no aliases, so node --test can import it.
//
// One library of agency-wide documents in four groups. Each document version
// is one nectar_documents row: Draft, Published or Archived, with a version
// number, an owner and a next-review date. A new version is a new row whose
// parent_document_id is the first version's id; the version it replaces keeps
// its row, archived, with superseded_by set.

export const LIBRARY_GROUPS = ["agency", "procedures", "state", "reference"] as const;
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

/** Groups an agency can put its own documents in. State rules come from PI (Decision 6). */
export const AGENCY_GROUPS = ["agency", "procedures", "reference"] as const;
export type AgencyGroup = (typeof AGENCY_GROUPS)[number];

export const LIBRARY_GROUP_LABEL: Record<LibraryGroup, string> = {
  agency: "Agency policies",
  procedures: "Procedures and forms",
  state: "State rules",
  reference: "Reference",
};

export const LIBRARY_STATUSES = ["draft", "published", "archived"] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export const LIBRARY_STATUS_LABEL: Record<LibraryStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const STATE_RULES_NOTE = "Loaded by PI for every agency";

/**
 * The library group for an old Knowledge base source kind: a "Policy /
 * procedure" upload (provider_policy) is an agency policy, a tool or template
 * is a procedure or form, anything else is reference. Same mapping as the N3
 * backfill.
 */
export function libraryGroupForKind(kind: string | null | undefined): AgencyGroup {
  if (kind === "provider_policy") return "agency";
  if (kind === "tool_template") return "procedures";
  return "reference";
}

/** The old source kind a library group shows as on screens that still read it. */
export function authoritativeKindForGroup(group: string | null | undefined): string {
  if (group === "agency") return "provider_policy";
  if (group === "procedures") return "tool_template";
  return "other";
}

/** parse_status as the Knowledge base shows it. A file with no readable text says so. */
export function parseStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "parsed":
      return "Parsed";
    case "no_text":
      return "No readable text";
    case "failed":
      return "Could not read the file";
    case "parsing":
    case "pending":
      return "Reading…";
    default:
      return "Not read";
  }
}

/** The next review date when none is given: one year after the publish day (YYYY-MM-DD). */
export function defaultReviewDue(publishedOn: string): string {
  const [y, m, d] = publishedOn.split("-").map(Number);
  return new Date(Date.UTC(y! + 1, m! - 1, d!)).toISOString().slice(0, 10);
}

/** A published version whose next review date has passed. */
export function isPastReview(reviewDue: string | null | undefined, today: string): boolean {
  return !!reviewDue && reviewDue < today;
}

/** The first version's id: every version of a document points at it. */
export function chainRootId(doc: { id: string; parent_document_id: string | null }): string {
  return doc.parent_document_id ?? doc.id;
}

export interface LibraryRowBase {
  id: string;
  title: string;
  library_group: string | null;
  library_status: string;
  superseded_by: string | null;
  version: number;
  created_at: string;
}

/** The current version of each document: the one nothing has replaced. */
export function currentVersions<T extends LibraryRowBase>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.superseded_by && r.library_group);
}

/** The four groups in their fixed order, each sorted by title. Archived documents sort last. */
export function groupLibrary<T extends LibraryRowBase>(rows: readonly T[]) {
  return LIBRARY_GROUPS.map((group) => ({
    group,
    label: LIBRARY_GROUP_LABEL[group],
    documents: currentVersions(rows)
      .filter((r) => r.library_group === group)
      .sort(
        (a, b) =>
          Number(a.library_status === "archived") - Number(b.library_status === "archived") ||
          a.title.localeCompare(b.title),
      ),
  }));
}

/** Text a person typed in the New document box: tidy line ends, no trailing spaces. */
export function normalizeDraftText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A storage-safe file name for typed text: "Grievance Policy" -> "Grievance_Policy.txt". */
export function typedTextFileName(title: string): string {
  const base = title
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${base || "document"}.txt`;
}

/** Old stored text was cut at exactly 50,000 characters; such text is re-read from its file. */
export const OLD_TEXT_CUT = 50_000;

export function looksCut(text: string | null | undefined): boolean {
  return (text ?? "").length === OLD_TEXT_CUT;
}
