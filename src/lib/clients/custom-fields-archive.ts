// Custom field rules. Definitions are archived, never deleted, so the values
// already saved on clients (or team members) stay. Pure, importable by node --test.

import type { CategoryId } from "../access/categories.ts";

/** Chunk size for `custom_field_definitions` `.in("id", …)` calls. */
export const CUSTOM_FIELD_ARCHIVE_CHUNK = 80;

export type CustomFieldKind = "client" | "employee";

export const ARCHIVED_FIELD_MESSAGE = "This field is archived. Restore it to change its values.";
export const FIELD_NOT_FOUND_MESSAGE = "Forbidden: definition not in this organization";
export const FIELD_KIND_MISMATCH_MESSAGE = "This field doesn't belong to that kind of record.";
export const AGENCY_WIDE_FIELDS_MESSAGE =
  "Custom fields apply to the whole agency, so only whole-agency access can add, archive or restore them.";

/** Deduped id batches so updates stay inside PostgREST URL / RLS row limits. */
export function chunkIds(
  ids: string[],
  size: number = CUSTOM_FIELD_ARCHIVE_CHUNK,
): string[][] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (!unique.length) return [];
  const out: string[][] = [];
  const step = size > 0 ? size : CUSTOM_FIELD_ARCHIVE_CHUNK;
  for (let i = 0; i < unique.length; i += step) {
    out.push(unique.slice(i, i + step));
  }
  return out;
}

/** Which category guards a kind's fields: clients for client fields, the roster for team members. */
export function categoryForFieldKind(kind: CustomFieldKind): CategoryId {
  return kind === "client" ? "clients" : "staff_roster";
}

/** A value may be set only on a live definition of the same kind in this agency. */
export function assertDefinitionWritable(
  def: { entity_kind: string; archived_at: string | null } | null,
  kind: CustomFieldKind,
): void {
  if (!def) throw new Error(FIELD_NOT_FOUND_MESSAGE);
  if (def.entity_kind !== kind) throw new Error(FIELD_KIND_MISMATCH_MESSAGE);
  if (def.archived_at) throw new Error(ARCHIVED_FIELD_MESSAGE);
}

export function customFieldArchiveCopy(labels: string[]): {
  title: string;
  body: string;
} {
  const count = labels.length;
  const after =
    "It stops taking new values. Values already saved stay on each client, labelled as an archived field, and you can restore it later.";
  if (count <= 0) {
    return { title: "Archive custom fields?", body: "Nothing is selected." };
  }
  if (count === 1) {
    const name = labels[0] ?? "this field";
    return { title: `Archive "${name}"?`, body: `This archives "${name}" for every client. ${after}` };
  }
  const listed = labels.slice(0, 5).map((l) => `"${l}"`).join(", ");
  const extra = count > 5 ? ` and ${count - 5} more` : "";
  return {
    title: `Archive ${count} custom fields?`,
    body: `This archives ${listed}${extra} for every client. ${after.replace("It stops", "They stop").replace("restore it", "restore them")}`,
  };
}
