// A simple dated list with an "Add" button and a remove (archive) action,
// shared by the health events log and the absences card.

import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardShell } from "@/components/clients/profile/cards/card-shell";

export function RecordList<T extends { id: string }>({
  title,
  subtitle,
  testId,
  rows,
  loading,
  empty,
  canEdit,
  onAdd,
  onRemove,
  render,
  children,
}: {
  title: string;
  subtitle?: string;
  testId: string;
  rows: T[];
  loading: boolean;
  empty: string;
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (row: T) => void;
  render: (row: T) => ReactNode;
  children?: ReactNode;
}) {
  return (
    <CardShell
      title={title}
      subtitle={subtitle}
      headerRight={
        canEdit ? (
          <Button size="sm" variant="outline" className="gap-1" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        ) : null
      }
    >
      <div data-testid={testId}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">{render(r)}</div>
                {canEdit ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label="Remove"
                    onClick={() => window.confirm("Remove this entry? It stays in the record history.") && onRemove(r)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </CardShell>
  );
}
