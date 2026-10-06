// Office notes about a client (client_notes): visible only to people who
// can edit clients, never to staff on shift. Archived, never deleted.
// Pure — importable by node --test.

export const CLIENT_NOTE_MAX = 4000;

export type ClientNote = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
};

export function cleanNoteBody(
  body: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = body.trim();
  if (!value) return { ok: false, error: "Write the note first." };
  if (value.length > CLIENT_NOTE_MAX) {
    return { ok: false, error: `Keep notes under ${CLIENT_NOTE_MAX} characters.` };
  }
  return { ok: true, value };
}

/** Open notes, newest first. */
export function openNotes<T extends Pick<ClientNote, "created_at" | "archived_at">>(
  notes: readonly T[],
): T[] {
  return notes
    .filter((n) => !n.archived_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Clock-in to clock-out in hours (one decimal), or null while open. */
export function shiftHours(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  const ms = Date.parse(clockOut) - Date.parse(clockIn);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round((ms / 3_600_000) * 10) / 10;
}
