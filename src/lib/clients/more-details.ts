// More details: the agency's own client fields. Primary language is no
// longer shown there (an import may still save it as a custom value).
// Fields are archived, never deleted: an archived field takes no new values,
// but a value already saved on a client still shows, labelled as archived.
// Pure, importable by node --test.

/** Custom field keys More details leaves out. */
export const HIDDEN_DETAIL_KEYS: ReadonlySet<string> = new Set(["primary_language"]);

export const ARCHIVED_FIELD_SUFFIX = " (archived field)";

type ValueLike = {
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
} | null;

type FieldLike = { field_key: string; archived?: boolean; value?: ValueLike };

/** Whether a saved value is there to show. */
export function hasCustomValue(value: ValueLike | undefined): boolean {
  if (!value) return false;
  return (
    !!value.value_text?.trim() ||
    value.value_number != null ||
    value.value_boolean != null ||
    !!value.value_date
  );
}

/**
 * The agency's own fields, in order, without the hidden ones. Out of edit
 * mode an archived field shows only where this client has a value; in edit
 * mode every archived field is listed so it can be restored.
 */
export function moreDetailsFields<T extends FieldLike>(
  fields: readonly T[],
  opts: { editing?: boolean } = {},
): T[] {
  return fields.filter((f) => {
    if (HIDDEN_DETAIL_KEYS.has(f.field_key)) return false;
    if (f.archived && !opts.editing) return hasCustomValue(f.value);
    return true;
  });
}

/** The label to show: archived fields say so. */
export function customFieldLabel(f: { field_label: string; archived?: boolean }): string {
  return f.archived ? `${f.field_label}${ARCHIVED_FIELD_SUFFIX}` : f.field_label;
}
