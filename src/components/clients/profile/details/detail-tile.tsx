// One custom client field as a small read-only tile in More details.

import type { CustomFieldWithValue } from "@/lib/clients/care-data.functions";
import { formatDate } from "@/lib/clients/dates";

/** Small muted tile: the field's label and its value (or a dash). */
export function DetailTile({ field }: { field: CustomFieldWithValue }) {
  const v = field.value;
  const text =
    field.data_type === "boolean"
      ? v?.value_boolean == null
        ? null
        : v.value_boolean
          ? "Yes"
          : "No"
      : field.data_type === "number"
        ? v?.value_number == null
          ? null
          : String(v.value_number)
        : field.data_type === "date"
          ? v?.value_date
            ? formatDate(v.value_date)
            : null
          : v?.value_text?.trim() || null;
  return (
    <li className="min-w-0 rounded-xl bg-[var(--hive-muted-surface)] px-3 py-2">
      <p className="text-xs text-muted-foreground">{field.field_label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-hive-ink">
        {text ?? <span className="font-normal text-muted-foreground">—</span>}
      </p>
    </li>
  );
}
