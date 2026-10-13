// More details: the agency's own client fields. Primary language is no
// longer shown there (an import may still save it as a custom value).
// Pure, importable by node --test.

/** Custom field keys More details leaves out. */
export const HIDDEN_DETAIL_KEYS: ReadonlySet<string> = new Set(["primary_language"]);

/** The agency's own fields, in order, without the hidden ones. */
export function moreDetailsFields<T extends { field_key: string }>(fields: readonly T[]): T[] {
  return fields.filter((f) => !HIDDEN_DETAIL_KEYS.has(f.field_key));
}
