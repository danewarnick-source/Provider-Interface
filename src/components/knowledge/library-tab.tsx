import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  documentChip,
  documentCount,
  reviewDueLabel,
  reviewedLabel,
  slotLine,
} from "@/lib/nectar/library/knowledge-view";
import { listLibrary } from "@/lib/nectar/library/library.functions";
import { STATE_RULES_NOTE } from "@/lib/nectar/library/library";
import { KnowledgeError, KnowledgeLoading } from "./knowledge-states";
import { StatusChip } from "./status-chip";
import { knowledgeKey, useKnowledgeNav } from "./use-knowledge";

type LibraryRow = Awaited<ReturnType<typeof listLibrary>>["groups"][number]["documents"][number];

const ROW_GRID =
  "grid min-w-[700px] grid-cols-[minmax(0,2.4fr)_minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3";

/** Library tab: the four groups; each row opens its document. */
export function LibraryTab({ orgId }: { orgId: string }) {
  const listFn = useServerFn(listLibrary);
  const nav = useKnowledgeNav();
  const q = useQuery({
    queryKey: knowledgeKey(orgId, "library"),
    queryFn: () => listFn({ data: { organizationId: orgId } }),
  });
  if (q.isLoading) return <KnowledgeLoading />;
  if (q.error || !q.data) return <KnowledgeError error={q.error} />;

  return (
    <div className="space-y-6">
      {q.data.groups.map((group) => (
        <section
          key={group.group}
          aria-labelledby={`kb-group-${group.group}`}
          className="space-y-2"
        >
          <div>
            <h2
              id={`kb-group-${group.group}`}
              className="text-base font-semibold text-[var(--hive-text)]"
            >
              {group.label}{" "}
              <span className="font-normal text-muted-foreground">
                · {documentCount(group.documents.length)}
              </span>
            </h2>
            {group.group === "state" ? (
              <p className="text-xs text-muted-foreground">{STATE_RULES_NOTE}. Read-only.</p>
            ) : null}
          </div>
          {group.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              No documents yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {group.documents.map((doc) => (
                  <LibraryItem
                    key={doc.id}
                    doc={doc}
                    onOpen={() =>
                      doc.kind === "state_rule"
                        ? nav.openStateRule(doc.id)
                        : nav.openDocument(doc.id)
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        Columns: name, version, status, owner, next review, team members who reviewed the current
        version.
      </p>
    </div>
  );
}

function LibraryItem({ doc, onOpen }: { doc: LibraryRow; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`${ROW_GRID} w-full px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--hive-hover)] focus-visible:bg-[var(--hive-hover)] focus-visible:outline-none`}
      >
        <span className="min-w-0">
          <span className="block font-semibold text-[var(--hive-text)]">{doc.title}</span>
          <span className="block text-xs text-muted-foreground">{slotLine(doc)}</span>
        </span>
        <span>v{doc.version}</span>
        <span>
          <StatusChip chip={documentChip(doc)} />
        </span>
        <span className="text-muted-foreground">
          {doc.kind === "state_rule" ? "PI" : (doc.owner ?? "—")}
        </span>
        <span className="text-muted-foreground">{reviewDueLabel(doc.reviewDue)}</span>
        <span className="text-muted-foreground">
          {reviewedLabel(doc.reviewed, doc.audienceAll)}
        </span>
      </button>
    </li>
  );
}
