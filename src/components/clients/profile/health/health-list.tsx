// One Health list (allergies, diagnoses, chronic conditions, diet,
// swallowing alerts, mobility) edited in place: each item is a chip with
// edit and remove, and "Add" opens a dropdown of common choices plus
// "Other (type it)". Every change saves the clients column right away
// (Client medical: Edit). Choices and rules: lib/clients/health/health-options.ts.

import { useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  HEALTH_LISTS,
  OTHER_LABEL,
  OTHER_OPTION,
  addHealthItem,
  editHealthItem,
  healthList,
  optionsToAdd,
  removeHealthItem,
  type HealthListKey,
} from "@/lib/clients/health/health-options";
import { useSaveHealth, type ClientHealthRow } from "./use-client-health";

const SELECT =
  "h-10 w-full rounded-md border border-input bg-background px-2 text-sm max-md:h-11 sm:w-64";
const ICON = "h-8 w-8 max-md:h-11 max-md:w-11";

export function HealthList({
  orgId,
  health,
  listKey,
  canEdit,
  danger = false,
  label,
}: {
  orgId: string;
  health: ClientHealthRow;
  listKey: HealthListKey;
  canEdit: boolean;
  /** Red chips (allergies, swallowing alerts). */
  danger?: boolean;
  /** Overrides the list's own label. */
  label?: string;
}) {
  const def = HEALTH_LISTS[listKey];
  const items = healthList(health[listKey]);
  const save = useSaveHealth(orgId, health.id);
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);

  const commit = (build: () => string[], after?: () => void) => {
    let next: string[];
    try {
      next = build();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the list.");
      return;
    }
    save.mutate({ [listKey]: next }, { onSuccess: () => after?.() });
  };
  const add = (value: string) =>
    commit(
      () => addHealthItem(items, value),
      () => setAdding(null),
    );
  const choices = optionsToAdd(listKey, items);

  return (
    <div data-testid={`health-list-${listKey}`}>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label ?? def.label}</p>
      {items.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, i) =>
            editing?.index === i ? (
              <li key={`${item}-${i}`} className="flex items-center gap-1">
                <Input
                  autoFocus
                  aria-label={`Edit ${item}`}
                  className="h-9 w-56"
                  value={editing.text}
                  onChange={(e) => setEditing({ index: i, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      commit(
                        () => editHealthItem(items, i, editing.text),
                        () => setEditing(null),
                      );
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className={ICON}
                  aria-label="Save"
                  disabled={save.isPending}
                  onClick={() =>
                    commit(
                      () => editHealthItem(items, i, editing.text),
                      () => setEditing(null),
                    )
                  }
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className={ICON}
                  aria-label="Cancel"
                  onClick={() => setEditing(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ) : (
              <li
                key={`${item}-${i}`}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border py-0.5 pl-3 text-sm",
                  danger
                    ? "border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)] font-medium text-[var(--hive-danger-fg)]"
                    : "border-hive-border bg-hive-surface text-hive-ink",
                  canEdit ? "pr-0.5" : "pr-3",
                )}
              >
                {item}
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/5 max-md:h-10 max-md:w-10 dark:hover:bg-white/10"
                      aria-label={`Edit ${item}`}
                      title="Edit"
                      onClick={() => setEditing({ index: i, text: item })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/5 max-md:h-10 max-md:w-10 dark:hover:bg-white/10"
                      aria-label={`Remove ${item}`}
                      title="Remove"
                      disabled={save.isPending}
                      onClick={() =>
                        window.confirm(`Remove "${item}" from ${def.label.toLowerCase()}?`) &&
                        commit(() => removeHealthItem(items, i))
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{def.empty}</p>
      )}
      {canEdit ? (
        adding === null ? (
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => setAdding("")}
            data-testid={`health-list-${listKey}-add`}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label={`Add to ${def.label.toLowerCase()}`}
              className={SELECT}
              value={adding === "" ? "" : OTHER_OPTION}
              autoFocus
              onChange={(e) => {
                if (e.target.value === OTHER_OPTION) setAdding(" ");
                else if (e.target.value) add(e.target.value);
              }}
              disabled={save.isPending}
            >
              <option value="">Choose…</option>
              {choices.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value={OTHER_OPTION}>{OTHER_LABEL}</option>
            </select>
            {adding !== "" ? (
              <>
                <Input
                  autoFocus
                  aria-label={`Type a ${def.label.toLowerCase()} item`}
                  placeholder="Type it"
                  className="h-10 w-56 max-md:h-11"
                  value={adding.trimStart()}
                  onChange={(e) => setAdding(e.target.value || " ")}
                  onKeyDown={(e) => e.key === "Enter" && add(adding)}
                />
                <Button disabled={save.isPending || !adding.trim()} onClick={() => add(adding)}>
                  Add
                </Button>
              </>
            ) : null}
            <Button variant="ghost" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
