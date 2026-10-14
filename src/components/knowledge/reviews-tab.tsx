import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { matrixCell } from "@/lib/nectar/library/knowledge-view";
import { getReviewMatrix } from "@/lib/nectar/library/library.functions";
import { KnowledgeError, KnowledgeLoading } from "./knowledge-states";
import { ReviewRecord } from "./review-record";
import { ReviewMark } from "./status-chip";
import { knowledgeKey } from "./use-knowledge";

/** Reviews tab: team members × published policies and procedures; a name opens their record. */
export function ReviewsTab({ orgId }: { orgId: string }) {
  const fn = useServerFn(getReviewMatrix);
  const [person, setPerson] = useState<string | null>(null);
  const q = useQuery({
    queryKey: knowledgeKey(orgId, "reviews"),
    queryFn: () => fn({ data: { organizationId: orgId } }),
  });
  if (q.isLoading) return <KnowledgeLoading />;
  if (q.error || !q.data) return <KnowledgeError error={q.error} />;
  const { documents, rows } = q.data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Each team member marks a policy as reviewed on their phone. A new version asks everyone
        again. Select a name to see their record.
      </p>
      {person ? (
        <ReviewRecord orgId={orgId} userId={person} onClose={() => setPerson(null)} />
      ) : null}
      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          No published policies or procedures yet. Reviews start when you publish one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm" style={{ minWidth: 200 + documents.length * 140 }}>
            <thead className="bg-[var(--hive-muted-surface)] text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Team member
                </th>
                {documents.map((doc) => (
                  <th key={doc.id} scope="col" className="px-3 py-3">
                    {doc.title} v{doc.version}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.userId}>
                  <th scope="row" className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => setPerson(row.userId)}
                      className="font-semibold text-[var(--hive-text)] underline underline-offset-2"
                    >
                      {row.name}
                    </button>
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.documentId} className="px-3 py-3 text-xs">
                      <ReviewMark mark={matrixCell(cell)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
