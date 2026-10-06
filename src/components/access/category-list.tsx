// The 18 access settings, each with a dropdown whose options explain what the
// person can and can't do at that setting.

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CATEGORIES,
  categoryChoices,
  valueLabel,
  type AccessCategory,
  type CategoryId,
  type CategoryValue,
} from "@/lib/access/categories";
import type { AccessLevel } from "@/lib/access/levels";
import { cn } from "@/lib/utils";

/** Staff can only get read-only views outside the phone app. */
function choicesFor(cat: AccessCategory, level: AccessLevel): CategoryValue[] {
  const all = categoryChoices(cat);
  return level === "staff" && cat.id !== "phone_app" ? all.filter((v) => v !== "edit") : all;
}

function CategoryRow({
  cat,
  level,
  value,
  presetValue,
  editing,
  onChange,
}: {
  cat: AccessCategory;
  level: AccessLevel;
  value: CategoryValue;
  presetValue?: CategoryValue;
  editing: boolean;
  onChange: (v: CategoryValue) => void;
}) {
  const changed = presetValue !== undefined && presetValue !== value;
  const locked = level === "owner" || cat.ownerOnly;
  return (
    <div className="grid gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{cat.label}</span>
          {cat.ownerOnly && <Badge variant="outline" className="text-[10px]">Owner only</Badge>}
          {changed && (
            <Badge variant="secondary" className="text-[10px]">
              Changed from preset ({valueLabel(cat, presetValue!)})
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{cat.covers}</p>
        <p className="mt-1 text-xs text-foreground/80">{cat.explain[value]}</p>
      </div>
      {editing && !locked ? (
        <Select value={value} onValueChange={(v) => onChange(v as CategoryValue)}>
          <SelectTrigger className="h-9 text-sm" aria-label={cat.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-w-sm">
            {choicesFor(cat, level).map((v) => (
              <SelectItem key={v} value={v} className="items-start py-2">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{valueLabel(cat, v)}</div>
                  <div className="whitespace-normal text-xs text-muted-foreground">{cat.explain[v]}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div
          className={cn(
            "self-start rounded-md border border-border px-3 py-1.5 text-sm",
            value === "off" ? "text-muted-foreground" : "font-medium",
          )}
        >
          {valueLabel(cat, value)}
        </div>
      )}
    </div>
  );
}

export function CategoryList({
  level,
  values,
  presetValues,
  editing,
  onChange,
}: {
  level: AccessLevel;
  values: Record<CategoryId, CategoryValue>;
  /** When set, rows that differ from the preset are marked. */
  presetValues?: Record<CategoryId, CategoryValue>;
  editing: boolean;
  onChange: (id: CategoryId, v: CategoryValue) => void;
}) {
  return (
    <div>
      {CATEGORIES.map((cat) => (
        <CategoryRow
          key={cat.id}
          cat={cat}
          level={level}
          value={level === "owner" ? "edit" : values[cat.id]}
          presetValue={presetValues?.[cat.id]}
          editing={editing}
          onChange={(v) => onChange(cat.id, v)}
        />
      ))}
    </div>
  );
}
