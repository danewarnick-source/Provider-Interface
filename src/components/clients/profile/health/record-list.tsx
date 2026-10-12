// A simple dated list with an "Add" button and a remove (archive) action,
// shared by the health events log and the absences card.

import type { ReactNode } from "react";
import { Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";

export function RecordList<T extends { id: string }>({
  icon,
  title,
  subtitle,
  addLabel,
  testId,
  rows,
  loading,
  empty,
  canEdit,
  onAdd,
  onRemove,
  render,
  children,
  id,
  addInCard = true,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Verb + thing, e.g. "Log a health event". */
  addLabel: string;
  testId: string;
  rows: T[];
  loading: boolean;
  empty: string;
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (row: T) => void;
  render: (row: T) => ReactNode;
  children?: ReactNode;
  id?: string;
  /** false when the section header already has the add button. */
  addInCard?: boolean;
}) {
  const add = (
    <Button onClick={onAdd}>
      <Plus className="h-4 w-4" /> {addLabel}
    </Button>
  );
  return (
    <SectionCard
      icon={icon}
      tone="danger"
      title={title}
      description={subtitle}
      id={id}
      actions={canEdit && addInCard && rows.length > 0 ? add : null}
    >
      <div data-testid={testId}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState action={canEdit ? add : null}>{empty}</EmptyState>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">{render(r)}</div>
                {canEdit ? (
                  <RowMenu
                    label="More actions for this entry"
                    items={[
                      {
                        label: "Remove entry",
                        danger: true,
                        onSelect: () =>
                          window.confirm("Remove this entry? It stays in the record history.") &&
                          onRemove(r),
                      },
                    ]}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </SectionCard>
  );
}
