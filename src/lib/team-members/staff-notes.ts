// Private notes about a team member (public.staff_notes). Append-only: there is
// no edit and no delete. Pure helpers; the reads and writes are in
// notes.functions.ts.

export const STAFF_NOTE_KINDS = ["note", "praise", "concern"] as const;
export type StaffNoteKind = (typeof STAFF_NOTE_KINDS)[number];

export const STAFF_NOTE_KIND_LABEL: Record<StaffNoteKind, string> = {
  note: "Note",
  praise: "Praise",
  concern: "Concern",
};

export const STAFF_NOTE_MAX = 5000;

export type StaffNote = {
  id: string;
  kind: StaffNoteKind;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

export const staffNotesQueryKey = (orgId: string | null | undefined, staffId: string) =>
  ["staff-notes", orgId ?? null, staffId] as const;

/** Trimmed body, or an error message matching the DB check (1–5000 characters). */
export function checkNoteBody(
  raw: string,
): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.trim();
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > STAFF_NOTE_MAX) {
    return { ok: false, error: `Notes can be up to ${STAFF_NOTE_MAX} characters.` };
  }
  return { ok: true, body };
}

export function isStaffNoteKind(v: unknown): v is StaffNoteKind {
  return typeof v === "string" && (STAFF_NOTE_KINDS as readonly string[]).includes(v);
}

/** Newest first; ties keep a stable order by id. */
export function sortNotesNewestFirst<T extends { createdAt: string; id: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) =>
    a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt),
  );
}
