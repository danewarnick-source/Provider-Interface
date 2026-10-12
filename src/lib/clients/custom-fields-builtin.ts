// Built-in client detail fields: shown in More details for every client even
// before the agency has a definition row (the first save creates it). They
// can't be deleted. Primary language moved here from the Identity card.

import type { CustomFieldWithValue } from "./care-data.functions";

export const BUILT_IN_CLIENT_FIELDS = [
  { field_key: "primary_language", field_label: "Primary language", section: "identity" },
] as const;

export type BuiltInClientFieldKey = (typeof BUILT_IN_CLIENT_FIELDS)[number]["field_key"];

/** The id a built-in field carries until its definition row exists. */
export const builtInPlaceholderId = (key: string) => `builtin:${key}`;

export const isPlaceholderField = (f: { id: string }) => f.id.startsWith("builtin:");

export const isBuiltInField = (f: { field_key: string }) =>
  BUILT_IN_CLIENT_FIELDS.some((b) => b.field_key === f.field_key);

/** Built-in fields first (a placeholder when undefined), then the agency's own. */
export function withBuiltInFields(fields: readonly CustomFieldWithValue[]): CustomFieldWithValue[] {
  const builtIns = BUILT_IN_CLIENT_FIELDS.map(
    (b) =>
      fields.find((f) => f.field_key === b.field_key) ?? {
        id: builtInPlaceholderId(b.field_key),
        field_key: b.field_key,
        field_label: b.field_label,
        data_type: "text" as const,
        section: b.section,
        value: null,
      },
  );
  return [...builtIns, ...fields.filter((f) => !isBuiltInField(f))];
}
