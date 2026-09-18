import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EvidenceStatusChip } from "@/components/evidence/evidence-status-chip.tsx";
import {
  itemForRequirement,
  itemsBySubject,
  matrixColumns,
  personRowSubtitle,
  type EvidenceMatrixColumn,
} from "@/lib/evidence/matrix.ts";
import { latestFileForItem, matrixChip } from "@/lib/evidence/status.ts";
import type { EvidenceFileRow, EvidenceItemRow, EvidencePerson } from "@/lib/evidence/types.ts";

export function EvidenceMatrix({
  people,
  items,
  files,
  today,
  search,
  onSearchChange,
  searchPlaceholder,
  peopleError,
  listLabel,
  emptyCopy,
  loading,
  selectedId,
  onSelectPerson,
  onAddForPerson,
  onReview,
  onSendAll,
}: {
  people: EvidencePerson[];
  items: EvidenceItemRow[];
  files: EvidenceFileRow[];
  today: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  peopleError: string | null;
  listLabel: string;
  emptyCopy: string;
  loading: boolean;
  selectedId?: string;
  onSelectPerson: (id: string) => void;
  onAddForPerson: (id: string) => void;
  onReview: (personId: string, itemId: string) => void;
  onSendAll: (person: EvidencePerson, itemIds: string[], titles: string[]) => void;
}) {
  const columns = matrixColumns(items);
  const bySubject = itemsBySubject(items);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 bg-[var(--hive-canvas)] pl-9"
          />
        </div>
        <p className="flex-1 text-[13px] text-[var(--hive-text-muted)]">
          Select a cell to add or review evidence.
        </p>
        <Button
          type="button"
          size="sm"
          disabled={!selectedId && people.length !== 1}
          onClick={() => {
            const id = selectedId ?? people[0]?.id;
            if (id) onAddForPerson(id);
          }}
        >
          Add packs
        </Button>
      </div>

      {peopleError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Could not load {listLabel}: {peopleError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-[var(--hive-border)] bg-[var(--hive-surface)] shadow-[0_1px_2px_rgba(36,48,64,0.04)]">
        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading Evidence…</div>
        ) : !people.length ? (
          <div className="p-8 text-sm text-muted-foreground">
            {peopleError ? `Could not load this list. ${peopleError}` : emptyCopy}
          </div>
        ) : columns.length === 0 ? (
          <EmptyPacks people={people} onAddForPerson={onAddForPerson} />
        ) : (
          <div className="matrix-wrap overflow-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 z-[1] bg-[var(--hive-canvas)] px-4 py-3.5 text-left text-[11px] font-semibold text-[var(--hive-text-muted)]">
                    Person
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="sticky top-0 z-[1] bg-[var(--hive-canvas)] px-2.5 py-3.5 text-left"
                    >
                      <div className="flex flex-col gap-0.5">
                        <b className="text-xs font-semibold text-[var(--hive-text)]">{col.title}</b>
                        <span className="text-[10.5px] font-medium text-[var(--hive-steel)]">
                          {col.subtitle}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <MatrixRow
                    key={person.id}
                    person={person}
                    columns={columns}
                    rows={bySubject.get(person.id) ?? []}
                    files={files}
                    today={today}
                    selected={selectedId === person.id}
                    onSelectPerson={onSelectPerson}
                    onAddForPerson={onAddForPerson}
                    onReview={onReview}
                    onSendAll={onSendAll}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyPacks({
  people,
  onAddForPerson,
}: {
  people: EvidencePerson[];
  onAddForPerson: (id: string) => void;
}) {
  return (
    <div className="space-y-3 p-8 text-sm text-muted-foreground">
      <p>No selected records yet. Use Add packs on a person.</p>
      <ul className="space-y-2">
        {people.slice(0, 8).map((person) => (
          <li key={person.id} className="flex items-center justify-between gap-3">
            <span className="font-medium text-[var(--hive-text)]">{person.full_name}</span>
            <Button type="button" size="sm" onClick={() => onAddForPerson(person.id)}>
              Add packs
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatrixRow({
  person,
  columns,
  rows,
  files,
  today,
  selected,
  onSelectPerson,
  onAddForPerson,
  onReview,
  onSendAll,
}: {
  person: EvidencePerson;
  columns: EvidenceMatrixColumn[];
  rows: EvidenceItemRow[];
  files: EvidenceFileRow[];
  today: string;
  selected: boolean;
  onSelectPerson: (id: string) => void;
  onAddForPerson: (id: string) => void;
  onReview: (personId: string, itemId: string) => void;
  onSendAll: (person: EvidencePerson, itemIds: string[], titles: string[]) => void;
}) {
  const keys = rows.map((row) => row.requirement_key);
  const subtitle = personRowSubtitle({ person, requirementKeys: keys });

  return (
    <tr className="hover:bg-[color-mix(in_srgb,var(--hive-gold)_4%,white)]">
      <td className="border-b border-[var(--hive-border)] px-4 py-3">
        <div className="flex min-w-[180px] items-center gap-2.5">
          <button
            type="button"
            onClick={() => onSelectPerson(person.id)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span
              className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border bg-[var(--hive-muted-surface)] text-[11px] font-bold text-[var(--hive-text)] ${
                selected
                  ? "border-[var(--hive-gold)] shadow-[0_0_0_1px_var(--hive-gold)]"
                  : "border-[var(--hive-border)]"
              }`}
            >
              {person.initials}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-[var(--hive-text)]">
                {person.full_name}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-[var(--hive-text-muted)]">
                {subtitle}
              </span>
            </span>
          </button>
          {rows.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Add packs for ${person.full_name}`}
              onClick={() => onAddForPerson(person.id)}
            >
              Add packs
            </Button>
          ) : rows.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Send all evidence for ${person.full_name}`}
              onClick={() =>
                onSendAll(
                  person,
                  rows.map((row) => row.id),
                  rows.map((row) => row.title),
                )
              }
            >
              Send
            </Button>
          ) : null}
        </div>
      </td>
      {columns.map((col) => {
        const item = itemForRequirement(rows, col.key);
        const file = item ? latestFileForItem(files, item.id) : null;
        const chip = matrixChip({ item, file, today });
        const interactive = chip.kind !== "na";
        return (
          <td key={col.key} className="border-b border-[var(--hive-border)] px-2.5 py-3">
            <EvidenceStatusChip
              chip={chip}
              interactive={interactive}
              ariaLabel={`${person.full_name}, ${col.title}, ${chip.label}`}
              onClick={() => {
                if (chip.itemId) onReview(person.id, chip.itemId);
                else if (chip.kind === "add") onAddForPerson(person.id);
              }}
            />
          </td>
        );
      })}
    </tr>
  );
}
