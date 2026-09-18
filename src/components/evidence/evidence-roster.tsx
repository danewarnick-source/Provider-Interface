import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EvidenceStatusChip } from "@/components/evidence/evidence-status-chip.tsx";
import { dueSubtitleFromItem } from "@/lib/evidence/due.ts";
import { itemsBySubject, personRowSubtitle, rowSummaryChips } from "@/lib/evidence/matrix.ts";
import { latestFileForItem, matrixChip } from "@/lib/evidence/status.ts";
import type { EvidenceFileRow, EvidenceItemRow, EvidencePerson } from "@/lib/evidence/types.ts";

export function EvidenceRoster({
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
  onTogglePerson,
  onAddForPerson,
  onReview,
  onSend,
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
  onTogglePerson: (id: string) => void;
  onAddForPerson: (id: string) => void;
  onReview: (personId: string, itemId: string) => void;
  onSend: (person: EvidencePerson, itemIds: string[], titles: string[]) => void;
}) {
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
          Open a row to add or review evidence.
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
        ) : (
          <ul>
            {people.map((person) => (
              <PersonAccordion
                key={person.id}
                person={person}
                rows={bySubject.get(person.id) ?? []}
                files={files}
                today={today}
                expanded={selectedId === person.id}
                onToggle={() => onTogglePerson(person.id)}
                onAddForPerson={onAddForPerson}
                onReview={onReview}
                onSend={onSend}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PersonAccordion({
  person,
  rows,
  files,
  today,
  expanded,
  onToggle,
  onAddForPerson,
  onReview,
  onSend,
}: {
  person: EvidencePerson;
  rows: EvidenceItemRow[];
  files: EvidenceFileRow[];
  today: string;
  expanded: boolean;
  onToggle: () => void;
  onAddForPerson: (id: string) => void;
  onReview: (personId: string, itemId: string) => void;
  onSend: (person: EvidencePerson, itemIds: string[], titles: string[]) => void;
}) {
  const chips = rows.map((row) =>
    matrixChip({ item: row, file: latestFileForItem(files, row.id), today }),
  );
  const summary = rowSummaryChips(chips);
  const subtitle = personRowSubtitle({
    person,
    requirementKeys: rows.map((row) => row.requirement_key),
  });

  return (
    <li className="border-b border-[var(--hive-border)] last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border bg-[var(--hive-muted-surface)] text-[11px] font-bold text-[var(--hive-text)] ${
              expanded
                ? "border-[var(--hive-gold)] shadow-[0_0_0_1px_var(--hive-gold)]"
                : "border-[var(--hive-border)]"
            }`}
          >
            {person.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-[var(--hive-text)]">
              {person.full_name}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-[var(--hive-text-muted)]">
              {subtitle}
            </span>
          </span>
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {summary.map((chip) => (
              <EvidenceStatusChip
                key={`${chip.kind}-${chip.label}`}
                chip={chip}
                ariaLabel={`${person.full_name}, ${chip.label}`}
              />
            ))}
          </span>
          <ChevronRight
            aria-hidden
            className={`h-4 w-4 shrink-0 text-[var(--hive-steel)] transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Add packs for ${person.full_name}`}
          onClick={() => onAddForPerson(person.id)}
        >
          Add packs
        </Button>
      </div>
      {expanded ? (
        <div className="space-y-2 border-t border-[var(--hive-border)] bg-[var(--hive-canvas)] px-4 py-3">
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--hive-text-muted)]">
              No selected records yet. Use Add packs for this person.
            </p>
          ) : (
            rows.map((row) => {
              const chip = matrixChip({
                item: row,
                file: latestFileForItem(files, row.id),
                today,
              });
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--hive-border)] bg-[var(--hive-surface)] px-3 py-2.5"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onReview(person.id, row.id)}
                  >
                    <span className="block text-sm font-medium text-[var(--hive-text)]">
                      {row.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--hive-text-muted)]">
                      {row.evidence_type === "attestation" ? "Attestation" : "Upload"} ·{" "}
                      {dueSubtitleFromItem(row)}
                    </span>
                  </button>
                  <EvidenceStatusChip
                    chip={chip}
                    interactive
                    ariaLabel={`${person.full_name}, ${row.title}, ${chip.label}`}
                    onClick={() => onReview(person.id, row.id)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onSend(person, [row.id], [row.title])}
                  >
                    Send
                  </Button>
                </div>
              );
            })
          )}
          {rows.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onSend(
                  person,
                  rows.map((row) => row.id),
                  rows.map((row) => row.title),
                )
              }
            >
              Send all to employee
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
