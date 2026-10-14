import type { ReactNode } from "react";
import { noSectionsNote } from "@/lib/nectar/library/knowledge-view";

type Section = { heading: string | null; body: string; position: number };

/** A version's sections as Nectar searches and cites them (heading, then text). */
export function DocumentSections({
  sections,
  parseStatus,
}: {
  sections: Section[];
  parseStatus?: string | null;
}) {
  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">{noSectionsNote(parseStatus)}</p>;
  }
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.position} className="space-y-1">
          {s.heading ? (
            <h2 className="text-base font-semibold text-[var(--hive-text)]">{s.heading}</h2>
          ) : null}
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--hive-text)]">
            {s.body}
          </p>
        </section>
      ))}
    </div>
  );
}

/** A side panel card (Versions, Who it's for, Reviewed vN). */
export function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-[var(--hive-text)]">{title}</h2>
      {children}
    </section>
  );
}

/** The Versions panel: newest first; older versions open read-only. */
export function VersionsList({
  versions,
  currentId,
  onOpen,
}: {
  versions: Array<{ id: string; label: string; note: string }>;
  currentId: string;
  onOpen?: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border text-sm">
      {versions.map((v) => (
        <li key={v.id} className="py-2">
          {v.id === currentId || !onOpen ? (
            <p className="font-semibold">{v.label}</p>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(v.id)}
              className="font-semibold underline-offset-2 hover:underline"
            >
              {v.label}
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            {v.id === currentId ? `Open now · ${v.note}` : v.note}
          </p>
        </li>
      ))}
    </ul>
  );
}
